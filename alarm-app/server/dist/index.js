"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const express_2 = require("express");
const routes_1 = __importDefault(require("./routes"));
const node_fetch_1 = __importDefault(require("node-fetch"));
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use((0, express_2.json)());
app.get('/health', (_req, res) => {
    res.json({ ok: true });
});
app.use('/api', routes_1.default);
const port = Number(process.env.PORT || 4000);
const server = app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
});
// Simple in-process scheduler for demo
const schedulerInterval = 60 * 1000;
setInterval(async () => {
    try {
        await (0, node_fetch_1.default)(`http://localhost:${port}/api/__internal/scheduler/tick`, { method: 'POST' });
    }
    catch (err) {
        // ignore errors for demo
    }
}, schedulerInterval);
exports.default = server;
