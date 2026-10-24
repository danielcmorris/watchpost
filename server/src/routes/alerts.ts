import type { FastifyInstance } from 'fastify';
import { validMonitorToken } from '../alert-links.js';
import { config } from '../config.js';
import { pool } from '../db/pool.js';

/** A signed alert grants only this monitor's status and history; it never creates an admin session. */
export function alertRoutes(app: FastifyInstance): void {
  app.get<{ Params: { id: string } }>('/api/alert/monitors/:id', async (req, reply) => {
    reply.header('Cache-Control', 'no-store').header('Referrer-Policy', 'no-referrer');
    const id = Number(req.params.id);
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!validMonitorToken(token, id, config.sessionSecret)) {
      return reply.code(403).send({ error: 'This alert link is invalid or has expired.' });
    }

    const monitor = await pool.query('SELECT id, name, type, status, paused, last_check_at FROM monitors WHERE id=$1', [id]);
    if (!monitor.rows[0]) return reply.code(404).send({ error: 'Monitor not found.' });
    const [summary, daily, incidents] = await Promise.all([
      pool.query(
        `SELECT round(100.0 * count(*) FILTER (WHERE ok) / NULLIF(count(*),0), 2)::float AS uptime_24h,
                round(avg(latency_ms) FILTER (WHERE ok))::int AS avg_latency_ms
         FROM checks WHERE monitor_id=$1 AND ts > now() - interval '24 hours'`, [id],
      ),
      pool.query('SELECT day::text AS day, total, ok FROM check_daily WHERE monitor_id=$1 AND day > current_date - 90 ORDER BY day', [id]),
      pool.query('SELECT started_at, resolved_at, cause FROM incidents WHERE monitor_id=$1 ORDER BY started_at DESC LIMIT 30', [id]),
    ]);
    return { monitor: monitor.rows[0], summary: summary.rows[0], daily: daily.rows, incidents: incidents.rows };
  });
}
