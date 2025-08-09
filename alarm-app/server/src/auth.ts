import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from './prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';

export interface AuthJwtPayload {
  userId: string;
}

export function signJwt(payload: AuthJwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function authMiddleware(req: Request & { userId?: string }, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'Missing Authorization header' });
  const token = header.replace(/^Bearer\s+/i, '');
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthJwtPayload;
    req.userId = decoded.userId;
    return next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

const signupSchema = z.object({
  email: z.string().email(),
  phone: z.string().min(8),
  password: z.string().min(6),
  displayName: z.string().min(1),
});

export async function handleSignup(req: Request, res: Response) {
  const parse = signupSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });
  const { email, phone, password, displayName } = parse.data;
  const existing = await prisma.user.findFirst({ where: { OR: [{ email }, { phone }] } });
  if (existing) return res.status(409).json({ error: 'Email or phone already in use' });
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({ data: { email, phone, passwordHash, displayName } });
  const token = signJwt({ userId: user.id });
  return res.json({ token, user: { id: user.id, email: user.email, phone: user.phone, displayName: user.displayName } });
}

const loginSchema = z.object({
  emailOrPhone: z.string(),
  password: z.string().min(6),
});

export async function handleLogin(req: Request, res: Response) {
  const parse = loginSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });
  const { emailOrPhone, password } = parse.data;
  const user = await prisma.user.findFirst({ where: { OR: [{ email: emailOrPhone }, { phone: emailOrPhone }] } });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const token = signJwt({ userId: user.id });
  return res.json({ token, user: { id: user.id, email: user.email, phone: user.phone, displayName: user.displayName } });
}