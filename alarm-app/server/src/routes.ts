import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from './prisma';
import { authMiddleware, handleLogin, handleSignup } from './auth';

const router = Router();

// Auth
router.post('/auth/signup', handleSignup);
router.post('/auth/login', handleLogin);

// Group creation and membership
const createGroupSchema = z.object({ name: z.string().min(1) });
router.post('/groups', authMiddleware, async (req: Request & { userId?: string }, res: Response) => {
  const parsed = createGroupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const group = await prisma.group.create({
    data: {
      name: parsed.data.name,
      ownerId: req.userId!,
      members: { create: { userId: req.userId!, status: 'APPROVED', role: 'ADMIN' } },
    },
  });
  res.json(group);
});

const inviteSchema = z.object({ userId: z.string().cuid() });
router.post('/groups/:groupId/invite', authMiddleware, async (req: Request & { userId?: string }, res: Response) => {
  const groupId = req.params.groupId;
  const parsed = inviteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  // Only owner or admin can invite
  const gm = await prisma.groupMember.findFirst({ where: { groupId, userId: req.userId!, status: 'APPROVED' } });
  if (!gm) return res.status(403).json({ error: 'Not a member' });

  // Create pending membership
  const membership = await prisma.groupMember.upsert({
    where: { groupId_userId: { groupId, userId: parsed.data.userId } },
    create: { groupId, userId: parsed.data.userId, status: 'PENDING' },
    update: { status: 'PENDING' },
  });

  res.json(membership);
});

// User applies to join a group (PENDING)
router.post('/groups/:groupId/apply', authMiddleware, async (req: Request & { userId?: string }, res: Response) => {
  const groupId = req.params.groupId;
  const membership = await prisma.groupMember.upsert({
    where: { groupId_userId: { groupId, userId: req.userId! } },
    create: { groupId, userId: req.userId!, status: 'PENDING' },
    update: { status: 'PENDING' },
  });
  res.json(membership);
});

// Admin approves a member
router.post('/groups/:groupId/members/:userId/approve', authMiddleware, async (req: Request & { userId?: string }, res: Response) => {
  const groupId = req.params.groupId;
  const targetUserId = req.params.userId;
  const admin = await prisma.groupMember.findFirst({ where: { groupId, userId: req.userId!, status: 'APPROVED' } });
  if (!admin) return res.status(403).json({ error: 'Not a member' });
  const membership = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId: targetUserId } } });
  if (!membership) return res.status(404).json({ error: 'Membership not found' });
  if (membership.status === 'APPROVED') return res.json(membership);
  const updated = await prisma.groupMember.update({ where: { id: membership.id }, data: { status: 'APPROVED' } });
  res.json(updated);
});

// User approves membership (self-approval)
router.post('/groups/:groupId/approve', authMiddleware, async (req: Request & { userId?: string }, res: Response) => {
  const groupId = req.params.groupId;
  const membership = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId: req.userId! } } });
  if (!membership) return res.status(404).json({ error: 'Invitation not found' });
  if (membership.status === 'APPROVED') return res.json(membership);
  const updated = await prisma.groupMember.update({ where: { id: membership.id }, data: { status: 'APPROVED' } });
  res.json(updated);
});

// Create an alarm for a group with between 2 and 10 members
const createAlarmSchema = z.object({
  title: z.string().min(1),
  message: z.string().default(''),
  scheduledAt: z.string().datetime(),
  reAlarmIntervalMinutes: z.number().int().min(1).max(60).default(10),
  participantUserIds: z.array(z.string().cuid()).min(2).max(10),
});

router.post('/groups/:groupId/alarms', authMiddleware, async (req: Request & { userId?: string }, res: Response) => {
  const groupId = req.params.groupId;
  const parsed = createAlarmSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  // Ensure requester is approved member
  const requester = await prisma.groupMember.findFirst({ where: { groupId, userId: req.userId!, status: 'APPROVED' } });
  if (!requester) return res.status(403).json({ error: 'Not a group member' });

  // Ensure all participants are approved members of the group
  const members = await prisma.groupMember.findMany({ where: { groupId, userId: { in: parsed.data.participantUserIds }, status: 'APPROVED' } });
  if (members.length !== parsed.data.participantUserIds.length) return res.status(400).json({ error: 'All participants must be approved group members' });

  const scheduledAt = new Date(parsed.data.scheduledAt);

  const alarm = await prisma.alarm.create({
    data: {
      groupId,
      title: parsed.data.title,
      message: parsed.data.message,
      scheduledAt,
      status: 'SCHEDULED',
      reAlarmIntervalMinutes: parsed.data.reAlarmIntervalMinutes,
      nextTriggerAt: scheduledAt,
      participants: {
        createMany: { data: parsed.data.participantUserIds.map((userId) => ({ userId })) },
      },
    },
    include: { participants: true },
  });

  res.json(alarm);
});

// Dismiss alarm for current cycle. When all participants dismiss, mark alarm completed and increment users' successfulDismissCount
const dismissSchema = z.object({});
router.post('/alarms/:alarmId/dismiss', authMiddleware, async (req: Request & { userId?: string }, res: Response) => {
  const alarmId = req.params.alarmId;
  const userId = req.userId!;

  const alarm = await prisma.alarm.findUnique({ where: { id: alarmId }, include: { participants: true, cycles: { orderBy: { cycleNumber: 'desc' }, take: 1 } } });
  if (!alarm) return res.status(404).json({ error: 'Alarm not found' });

  // Ensure user is participant
  const isParticipant = alarm.participants.some((p) => p.userId === userId);
  if (!isParticipant) return res.status(403).json({ error: 'Not a participant' });

  // Ensure there is an active cycle
  const currentCycle = alarm.cycles[0];
  if (!currentCycle) return res.status(400).json({ error: 'No active cycle to dismiss' });

  // Upsert cycle participant dismissal
  await prisma.alarmCycleParticipant.upsert({
    where: { alarmCycleId_userId: { alarmCycleId: currentCycle.id, userId } },
    create: { alarmCycleId: currentCycle.id, userId, dismissedAt: new Date() },
    update: { dismissedAt: new Date() },
  });

  // Check if all dismissed
  const totalParticipants = alarm.participants.length;
  const dismissedCount = await prisma.alarmCycleParticipant.count({ where: { alarmCycleId: currentCycle.id, dismissedAt: { not: null } } });

  if (dismissedCount >= totalParticipants) {
    // Complete alarm and update user counters
    await prisma.$transaction([
      prisma.alarm.update({ where: { id: alarm.id }, data: { status: 'COMPLETED', completedAt: new Date(), nextTriggerAt: null } }),
      prisma.user.updateMany({ where: { id: { in: alarm.participants.map((p) => p.userId) } }, data: { successfulDismissCount: { increment: 1 } } }),
    ]);
  }

  res.json({ ok: true });
});

// Public leaderboard
router.get('/leaderboard', async (_req, res) => {
  const top = await prisma.user.findMany({ orderBy: { successfulDismissCount: 'desc' }, take: 50, select: { id: true, displayName: true, successfulDismissCount: true } });
  res.json(top);
});

// Scheduler tick to trigger alarms (internal). In production use a real cron/worker.
router.post('/__internal/scheduler/tick', async (_req, res) => {
  const now = new Date();
  const dueAlarms = await prisma.alarm.findMany({
    where: { status: { in: ['SCHEDULED', 'TRIGGERED'] }, nextTriggerAt: { lte: now } },
    include: { participants: true, cycles: true },
  });

  for (const alarm of dueAlarms) {
    // If previously triggered, check last cycle dismissals
    const lastCycle = alarm.cycles.sort((a, b) => b.cycleNumber - a.cycleNumber)[0];
    let allDismissed = false;
    if (lastCycle) {
      const dismissedCount = await prisma.alarmCycleParticipant.count({ where: { alarmCycleId: lastCycle.id, dismissedAt: { not: null } } });
      allDismissed = dismissedCount >= alarm.participants.length;
    }

    if (alarm.status === 'TRIGGERED' && allDismissed) {
      // Completed in dismiss endpoint path; skip here
      continue;
    }

    // Start new cycle
    const newCycleNumber = (alarm.currentCycleNumber ?? 0) + 1;
    await prisma.$transaction(async (tx) => {
      const cycle = await tx.alarmCycle.create({ data: { alarmId: alarm.id, cycleNumber: newCycleNumber } });
      await tx.alarm.update({
        where: { id: alarm.id },
        data: {
          status: 'TRIGGERED',
          currentCycleNumber: newCycleNumber,
          lastTriggeredAt: new Date(),
          nextTriggerAt: new Date(Date.now() + alarm.reAlarmIntervalMinutes * 60 * 1000),
        },
      });

      // Pre-create cycle participants for tracking
      await tx.alarmCycleParticipant.createMany({ data: alarm.participants.map((p) => ({ alarmCycleId: cycle.id, userId: p.userId })) });
    });

    // TODO: push notifications or actual alarm trigger to clients per participant
  }

  res.json({ processed: dueAlarms.length });
});

export default router;