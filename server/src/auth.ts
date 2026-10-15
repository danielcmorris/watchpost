import { createHash, randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { config } from './config.js';
import { pool } from './db/pool.js';

const COOKIE = 'sid';
const SESSION_DAYS = 14;
const hashId = (id: string) => createHash('sha256').update(id).digest('hex');

export async function seedAdmin(): Promise<void> {
  const { rowCount } = await pool.query('SELECT 1 FROM users LIMIT 1');
  if (rowCount) return;
  if (!config.adminPassword) throw new Error('No users exist and ADMIN_PASSWORD is not set');
  await pool.query('INSERT INTO users (username, password_hash) VALUES ($1,$2)', [
    config.adminUsername,
    await argon2.hash(config.adminPassword),
  ]);
  console.log(`[auth] seeded admin user "${config.adminUsername}"`);
}

export async function requireAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const sid = req.cookies[COOKIE];
  if (sid) {
    const { rows } = await pool.query(
      'SELECT u.id, u.username FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id=$1 AND s.expires_at > now()',
      [hashId(sid)],
    );
    if (rows[0]) {
      (req as FastifyRequest & { user?: unknown }).user = rows[0];
      return;
    }
  }
  await reply.code(401).send({ error: 'Unauthorized' });
}

const loginBody = z.object({ username: z.string().min(1).max(100), password: z.string().min(1).max(200) });

export function authRoutes(app: FastifyInstance): void {
  app.post('/api/auth/login', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => {
    const body = loginBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Invalid request' });
    const { rows } = await pool.query('SELECT id, password_hash FROM users WHERE username=$1', [body.data.username]);
    const ok = rows[0] && (await argon2.verify(rows[0].password_hash, body.data.password));
    if (!ok) return reply.code(401).send({ error: 'Invalid credentials' });
    const sid = randomBytes(32).toString('hex');
    await pool.query("INSERT INTO sessions (id, user_id, expires_at) VALUES ($1,$2, now() + make_interval(days => $3))", [
      hashId(sid), rows[0].id, SESSION_DAYS,
    ]);
    await pool.query('DELETE FROM sessions WHERE expires_at < now()');
    reply.setCookie(COOKIE, sid, {
      httpOnly: true, sameSite: 'lax', secure: config.secureCookies, path: '/', maxAge: SESSION_DAYS * 86400,
    });
    return { ok: true };
  });

  app.post('/api/auth/logout', async (req, reply) => {
    const sid = req.cookies[COOKIE];
    if (sid) await pool.query('DELETE FROM sessions WHERE id=$1', [hashId(sid)]);
    reply.clearCookie(COOKIE, { path: '/' });
    return { ok: true };
  });

  app.get('/api/auth/me', { preHandler: requireAuth }, async (req) => ({
    user: (req as FastifyRequest & { user?: { username: string } }).user?.username,
  }));
}
