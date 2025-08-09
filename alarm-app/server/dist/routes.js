"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = __importDefault(require("./prisma"));
const auth_1 = require("./auth");
const router = (0, express_1.Router)();
// Auth
router.post('/auth/signup', auth_1.handleSignup);
router.post('/auth/login', auth_1.handleLogin);
// Group creation and membership
const createGroupSchema = zod_1.z.object({ name: zod_1.z.string().min(1) });
router.post('/groups', auth_1.authMiddleware, async (req, res) => {
    const parsed = createGroupSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    const group = await prisma_1.default.group.create({
        data: {
            name: parsed.data.name,
            ownerId: req.userId,
            members: { create: { userId: req.userId, status: 'APPROVED', role: 'ADMIN' } },
        },
    });
    res.json(group);
});
const inviteSchema = zod_1.z.object({ userId: zod_1.z.string().cuid() });
router.post('/groups/:groupId/invite', auth_1.authMiddleware, async (req, res) => {
    const groupId = req.params.groupId;
    const parsed = inviteSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    // Only owner or admin can invite
    const gm = await prisma_1.default.groupMember.findFirst({ where: { groupId, userId: req.userId, status: 'APPROVED' } });
    if (!gm)
        return res.status(403).json({ error: 'Not a member' });
    // Create pending membership
    const membership = await prisma_1.default.groupMember.upsert({
        where: { groupId_userId: { groupId, userId: parsed.data.userId } },
        create: { groupId, userId: parsed.data.userId, status: 'PENDING' },
        update: { status: 'PENDING' },
    });
    res.json(membership);
});
// User applies to join a group (PENDING)
router.post('/groups/:groupId/apply', auth_1.authMiddleware, async (req, res) => {
    const groupId = req.params.groupId;
    const membership = await prisma_1.default.groupMember.upsert({
        where: { groupId_userId: { groupId, userId: req.userId } },
        create: { groupId, userId: req.userId, status: 'PENDING' },
        update: { status: 'PENDING' },
    });
    res.json(membership);
});
// Admin approves a member
router.post('/groups/:groupId/members/:userId/approve', auth_1.authMiddleware, async (req, res) => {
    const groupId = req.params.groupId;
    const targetUserId = req.params.userId;
    const admin = await prisma_1.default.groupMember.findFirst({ where: { groupId, userId: req.userId, status: 'APPROVED' } });
    if (!admin)
        return res.status(403).json({ error: 'Not a member' });
    const membership = await prisma_1.default.groupMember.findUnique({ where: { groupId_userId: { groupId, userId: targetUserId } } });
    if (!membership)
        return res.status(404).json({ error: 'Membership not found' });
    if (membership.status === 'APPROVED')
        return res.json(membership);
    const updated = await prisma_1.default.groupMember.update({ where: { id: membership.id }, data: { status: 'APPROVED' } });
    res.json(updated);
});
// User approves membership (self-approval)
router.post('/groups/:groupId/approve', auth_1.authMiddleware, async (req, res) => {
    const groupId = req.params.groupId;
    const membership = await prisma_1.default.groupMember.findUnique({ where: { groupId_userId: { groupId, userId: req.userId } } });
    if (!membership)
        return res.status(404).json({ error: 'Invitation not found' });
    if (membership.status === 'APPROVED')
        return res.json(membership);
    const updated = await prisma_1.default.groupMember.update({ where: { id: membership.id }, data: { status: 'APPROVED' } });
    res.json(updated);
});
// Create an alarm for a group with between 2 and 10 members
const createAlarmSchema = zod_1.z.object({
    title: zod_1.z.string().min(1),
    message: zod_1.z.string().default(''),
    scheduledAt: zod_1.z.string().datetime(),
    reAlarmIntervalMinutes: zod_1.z.number().int().min(1).max(60).default(10),
    participantUserIds: zod_1.z.array(zod_1.z.string().cuid()).min(2).max(10),
});
router.post('/groups/:groupId/alarms', auth_1.authMiddleware, async (req, res) => {
    const groupId = req.params.groupId;
    const parsed = createAlarmSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    // Ensure requester is approved member
    const requester = await prisma_1.default.groupMember.findFirst({ where: { groupId, userId: req.userId, status: 'APPROVED' } });
    if (!requester)
        return res.status(403).json({ error: 'Not a group member' });
    // Ensure all participants are approved members of the group
    const members = await prisma_1.default.groupMember.findMany({ where: { groupId, userId: { in: parsed.data.participantUserIds }, status: 'APPROVED' } });
    if (members.length !== parsed.data.participantUserIds.length)
        return res.status(400).json({ error: 'All participants must be approved group members' });
    const scheduledAt = new Date(parsed.data.scheduledAt);
    const alarm = await prisma_1.default.alarm.create({
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
const dismissSchema = zod_1.z.object({});
router.post('/alarms/:alarmId/dismiss', auth_1.authMiddleware, async (req, res) => {
    const alarmId = req.params.alarmId;
    const userId = req.userId;
    const alarm = await prisma_1.default.alarm.findUnique({ where: { id: alarmId }, include: { participants: true, cycles: { orderBy: { cycleNumber: 'desc' }, take: 1 } } });
    if (!alarm)
        return res.status(404).json({ error: 'Alarm not found' });
    // Ensure user is participant
    const isParticipant = alarm.participants.some((p) => p.userId === userId);
    if (!isParticipant)
        return res.status(403).json({ error: 'Not a participant' });
    // Ensure there is an active cycle
    const currentCycle = alarm.cycles[0];
    if (!currentCycle)
        return res.status(400).json({ error: 'No active cycle to dismiss' });
    // Upsert cycle participant dismissal
    await prisma_1.default.alarmCycleParticipant.upsert({
        where: { alarmCycleId_userId: { alarmCycleId: currentCycle.id, userId } },
        create: { alarmCycleId: currentCycle.id, userId, dismissedAt: new Date() },
        update: { dismissedAt: new Date() },
    });
    // Check if all dismissed
    const totalParticipants = alarm.participants.length;
    const dismissedCount = await prisma_1.default.alarmCycleParticipant.count({ where: { alarmCycleId: currentCycle.id, dismissedAt: { not: null } } });
    if (dismissedCount >= totalParticipants) {
        // Complete alarm and update user counters
        await prisma_1.default.$transaction([
            prisma_1.default.alarm.update({ where: { id: alarm.id }, data: { status: 'COMPLETED', completedAt: new Date(), nextTriggerAt: null } }),
            prisma_1.default.user.updateMany({ where: { id: { in: alarm.participants.map((p) => p.userId) } }, data: { successfulDismissCount: { increment: 1 } } }),
        ]);
    }
    res.json({ ok: true });
});
// Public leaderboard
router.get('/leaderboard', async (_req, res) => {
    const top = await prisma_1.default.user.findMany({ orderBy: { successfulDismissCount: 'desc' }, take: 50, select: { id: true, displayName: true, successfulDismissCount: true } });
    res.json(top);
});
// Scheduler tick to trigger alarms (internal). In production use a real cron/worker.
router.post('/__internal/scheduler/tick', async (_req, res) => {
    const now = new Date();
    const dueAlarms = await prisma_1.default.alarm.findMany({
        where: { status: { in: ['SCHEDULED', 'TRIGGERED'] }, nextTriggerAt: { lte: now } },
        include: { participants: true, cycles: true },
    });
    for (const alarm of dueAlarms) {
        // If previously triggered, check last cycle dismissals
        const lastCycle = alarm.cycles.sort((a, b) => b.cycleNumber - a.cycleNumber)[0];
        let allDismissed = false;
        if (lastCycle) {
            const dismissedCount = await prisma_1.default.alarmCycleParticipant.count({ where: { alarmCycleId: lastCycle.id, dismissedAt: { not: null } } });
            allDismissed = dismissedCount >= alarm.participants.length;
        }
        if (alarm.status === 'TRIGGERED' && allDismissed) {
            // Completed in dismiss endpoint path; skip here
            continue;
        }
        // Start new cycle
        const newCycleNumber = (alarm.currentCycleNumber ?? 0) + 1;
        await prisma_1.default.$transaction(async (tx) => {
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
exports.default = router;
