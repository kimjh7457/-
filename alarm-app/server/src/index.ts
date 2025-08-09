import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { json } from 'express';
import router from './routes';
import fetch from 'node-fetch';

dotenv.config();

const app = express();
app.use(cors());
app.use(json());

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api', router);

const port = Number(process.env.PORT || 4000);
const server = app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});

// Simple in-process scheduler for demo
const schedulerInterval = 60 * 1000;
setInterval(async () => {
  try {
    await fetch(`http://localhost:${port}/api/__internal/scheduler/tick`, { method: 'POST' });
  } catch (err) {
    // ignore errors for demo
  }
}, schedulerInterval);

export default server;