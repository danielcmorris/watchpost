import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import fstatic from '@fastify/static';
import Fastify from 'fastify';
import { authRoutes, seedAdmin } from './auth.js';
import { config } from './config.js';
import { pool } from './db/pool.js';
import { migrate } from './db/migrate.js';
import { startScheduler, stopScheduler } from './scheduler/index.js';
import { adminRoutes } from './routes/admin.js';
import { monitorRoutes } from './routes/monitors.js';
import { publicRoutes } from './routes/public.js';
import { alertRoutes } from './routes/alerts.js';

const app = Fastify({ logger: true, trustProxy: true });
await app.register(cookie);
await app.register(rateLimit, { global: false });

authRoutes(app);
await app.register(async (scoped) => monitorRoutes(scoped)); // auth hook is encapsulated here
adminRoutes(app);
publicRoutes(app);
alertRoutes(app);
app.get('/healthz', async () => ({ ok: true }));

const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../web/dist');
if (existsSync(webDir)) {
  await app.register(fstatic, { root: webDir });
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api/')) return reply.code(404).send({ error: 'Not found' });
    if (req.url.startsWith('/alert/')) reply.header('Cache-Control', 'no-store').header('Referrer-Policy', 'no-referrer');
    return reply.sendFile('index.html');
  });
}

await pool.query('SELECT 1');
await migrate();
await seedAdmin();
await app.listen({ port: config.port, host: '0.0.0.0' });
startScheduler();

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, async () => {
    stopScheduler();
    await app.close();
    await pool.end();
    process.exit(0);
  });
}
