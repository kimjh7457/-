"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signJwt = signJwt;
exports.authMiddleware = authMiddleware;
exports.handleSignup = handleSignup;
exports.handleLogin = handleLogin;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const zod_1 = require("zod");
const prisma_1 = __importDefault(require("./prisma"));
const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';
function signJwt(payload) {
    return jsonwebtoken_1.default.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}
function authMiddleware(req, res, next) {
    const header = req.headers.authorization;
    if (!header)
        return res.status(401).json({ error: 'Missing Authorization header' });
    const token = header.replace(/^Bearer\s+/i, '');
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        req.userId = decoded.userId;
        return next();
    }
    catch (e) {
        return res.status(401).json({ error: 'Invalid token' });
    }
}
const signupSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    phone: zod_1.z.string().min(8),
    password: zod_1.z.string().min(6),
    displayName: zod_1.z.string().min(1),
});
async function handleSignup(req, res) {
    const parse = signupSchema.safeParse(req.body);
    if (!parse.success)
        return res.status(400).json({ error: parse.error.flatten() });
    const { email, phone, password, displayName } = parse.data;
    const existing = await prisma_1.default.user.findFirst({ where: { OR: [{ email }, { phone }] } });
    if (existing)
        return res.status(409).json({ error: 'Email or phone already in use' });
    const passwordHash = await bcryptjs_1.default.hash(password, 12);
    const user = await prisma_1.default.user.create({ data: { email, phone, passwordHash, displayName } });
    const token = signJwt({ userId: user.id });
    return res.json({ token, user: { id: user.id, email: user.email, phone: user.phone, displayName: user.displayName } });
}
const loginSchema = zod_1.z.object({
    emailOrPhone: zod_1.z.string(),
    password: zod_1.z.string().min(6),
});
async function handleLogin(req, res) {
    const parse = loginSchema.safeParse(req.body);
    if (!parse.success)
        return res.status(400).json({ error: parse.error.flatten() });
    const { emailOrPhone, password } = parse.data;
    const user = await prisma_1.default.user.findFirst({ where: { OR: [{ email: emailOrPhone }, { phone: emailOrPhone }] } });
    if (!user)
        return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcryptjs_1.default.compare(password, user.passwordHash);
    if (!ok)
        return res.status(401).json({ error: 'Invalid credentials' });
    const token = signJwt({ userId: user.id });
    return res.json({ token, user: { id: user.id, email: user.email, phone: user.phone, displayName: user.displayName } });
}
