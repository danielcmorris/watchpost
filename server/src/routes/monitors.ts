import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { requireAuth } from '../auth.js';

const monitorConfig = z.object({
  expectedStatus: z.array(z.number().int().min(100).max(599)).max(20).optional(),
  keyword: z.string().max(500).optional(),
  keywordMode: z.enum(['present', 'absent']).optional(),
  port: z.number().int().min(1).max(65535).optional(),
  sslWarnDays: z.number().int().min(1).max(365).optional(),
}).strict();

const monitorBody = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(['http', 'keyword', 'ping', 'tcp', 'ssl']),
  target: z.string().min(1).max(2000),
  interval_s: z.number().int().min(30).max(86400).default(60),
  timeout_s: z.number().int().min(1).max(60).default(10),
  failure_threshold: z.number().int().min(1).max(10).default(2),
  config: monitorConfig.default({}),
  paused: z.boolean().default(false),
  contact_ids: z.array(z.number().int()).default([]),
}).superRefine((m, ctx) => {
  if ((m.type === 'http' || m.type === 'keyword') && !/^https?:\/\//i.test(m.target)) {
    ctx.addIssue({ code: 'custom', path: ['target'], message: 'Must start with http:// or https://' });
  }
  if (m.type === 'keyword' && !m.config.keyword) {
    ctx.addIssue({ code: 'custom', path: ['config', 'keyword'], message: 'Keyword required' });
  }
  if (m.type === 'tcp' && !m.config.port) {
    ctx.addIssue({ code: 'custom', path: ['config', 'port'], message: 'Port required' });
  }
});

const idParam = z.object({ id: z.coerce.number().int() });

async function setContacts(monitorId: number, ids: number[]): Promise<void> {
  await pool.query('DELETE FROM monitor_contacts WHERE monitor_id=$1', [monitorId]);
  if (ids.length) {
    await pool.query(
      'INSERT INTO monitor_contacts (monitor_id, contact_id) SELECT $1, unnest($2::int[]) ON CONFLICT DO NOTHING',
      [monitorId, ids],
    );
  }
}

export function monitorRoutes(app: FastifyInstance): void {
  app.addHook('preHandler', requireAuth);

  app.get('/api/monitors', async () => {
    const { rows } = await pool.query(
      `SELECT m.id, m.name, m.type, m.target, m.interval_s, m.timeout_s, m.failure_threshold, m.config,
              m.status, m.paused, m.last_check_at,
              (SELECT round(100.0 * count(*) FILTER (WHERE ok) / NULLIF(count(*),0), 2)::float
                 FROM checks c WHERE c.monitor_id = m.id AND c.ts > now() - interval '24 hours') AS uptime_24h,
              (SELECT latency_ms FROM checks c WHERE c.monitor_id = m.id ORDER BY ts DESC LIMIT 1) AS last_latency_ms,
              (SELECT COALESCE(array_agg(ok ORDER BY ts), '{}') FROM
                 (SELECT ok, ts FROM checks c WHERE c.monitor_id = m.id ORDER BY ts DESC LIMIT 40) r) AS recent,
              COALESCE((SELECT array_agg(contact_id) FROM monitor_contacts mc WHERE mc.monitor_id = m.id), '{}') AS contact_ids
       FROM monitors m ORDER BY m.name`,
    );
    return rows;
  });

  app.post('/api/monitors', async (req, reply) => {
    const b = monitorBody.safeParse(req.body);
    if (!b.success) return reply.code(400).send({ error: b.error.flatten() });
    const d = b.data;
    const { rows } = await pool.query(
      `INSERT INTO monitors (name,type,target,interval_s,timeout_s,failure_threshold,config,paused)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [d.name, d.type, d.target, d.interval_s, d.timeout_s, d.failure_threshold, d.config, d.paused],
    );
    await setContacts(rows[0].id, d.contact_ids);
    return reply.code(201).send({ id: rows[0].id });
  });

  app.put('/api/monitors/:id', async (req, reply) => {
    const p = idParam.safeParse(req.params);
    const b = monitorBody.safeParse(req.body);
    if (!p.success || !b.success) return reply.code(400).send({ error: 'Invalid request' });
    const d = b.data;
    const r = await pool.query(
      `UPDATE monitors SET name=$2,type=$3,target=$4,interval_s=$5,timeout_s=$6,failure_threshold=$7,config=$8,paused=$9,
              next_check_at=now()
       WHERE id=$1`,
      [p.data.id, d.name, d.type, d.target, d.interval_s, d.timeout_s, d.failure_threshold, d.config, d.paused],
    );
    if (!r.rowCount) return reply.code(404).send({ error: 'Not found' });
    await setContacts(p.data.id, d.contact_ids);
    return { ok: true };
  });

  app.delete('/api/monitors/:id', async (req, reply) => {
    const p = idParam.safeParse(req.params);
    if (!p.success) return reply.code(400).send({ error: 'Invalid request' });
    await pool.query('DELETE FROM monitors WHERE id=$1', [p.data.id]);
    return { ok: true };
  });

  app.get('/api/monitors/:id', async (req, reply) => {
    const p = idParam.safeParse(req.params);
    if (!p.success) return reply.code(400).send({ error: 'Invalid request' });
    const m = await pool.query('SELECT * FROM monitors WHERE id=$1', [p.data.id]);
    if (!m.rows[0]) return reply.code(404).send({ error: 'Not found' });
    const checks = await pool.query(
      `SELECT ts, ok, latency_ms, status_code, error FROM checks
       WHERE monitor_id=$1 AND ts > now() - interval '24 hours' ORDER BY ts`,
      [p.data.id],
    );
    const incidents = await pool.query(
      'SELECT id, started_at, resolved_at, cause FROM incidents WHERE monitor_id=$1 ORDER BY started_at DESC LIMIT 50',
      [p.data.id],
    );
    const daily = await pool.query(
      `SELECT day::text AS day, total, ok, avg_latency_ms FROM check_daily
       WHERE monitor_id=$1 AND day > current_date - 90 ORDER BY day`,
      [p.data.id],
    );
    return { monitor: m.rows[0], checks: checks.rows, incidents: incidents.rows, daily: daily.rows };
  });
}
