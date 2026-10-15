import type { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';

interface CacheEntry { at: number; body: unknown }
const cache = new Map<string, CacheEntry>();
const TTL_MS = 30_000;

export function publicRoutes(app: FastifyInstance): void {
  app.get<{ Params: { slug: string } }>('/api/public/status/:slug', async (req, reply) => {
    const slug = req.params.slug;
    const hit = cache.get(slug);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.body;

    const page = await pool.query('SELECT id, title FROM status_pages WHERE slug=$1', [slug]);
    if (!page.rows[0]) return reply.code(404).send({ error: 'Not found' });
    const pid = page.rows[0].id;

    // Whitelisted fields only: name, status, uptime, latency series. Never target/config.
    const monitors = await pool.query(
      `SELECT m.id, m.name, m.status,
        (SELECT round(100.0 * count(*) FILTER (WHERE ok) / NULLIF(count(*),0), 2)::float FROM checks c WHERE c.monitor_id=m.id AND c.ts > now() - interval '24 hours') AS uptime_24h,
        (SELECT round(100.0 * count(*) FILTER (WHERE ok) / NULLIF(count(*),0), 2)::float FROM checks c WHERE c.monitor_id=m.id AND c.ts > now() - interval '7 days') AS uptime_7d,
        (SELECT round(100.0 * count(*) FILTER (WHERE ok) / NULLIF(count(*),0), 2)::float FROM checks c WHERE c.monitor_id=m.id AND c.ts > now() - interval '30 days') AS uptime_30d
       FROM status_page_monitors s JOIN monitors m ON m.id = s.monitor_id
       WHERE s.page_id=$1 ORDER BY s.position`,
      [pid],
    );
    const ids = monitors.rows.map((m) => m.id);
    const daily = await pool.query(
      `SELECT monitor_id, day::text AS day, total, ok FROM check_daily WHERE monitor_id = ANY($1) AND day > current_date - 90 ORDER BY day`,
      [ids],
    );
    const latency = await pool.query(
      `SELECT monitor_id, date_trunc('hour', ts) AS t, avg(latency_ms)::int AS ms
       FROM checks WHERE monitor_id = ANY($1) AND ok AND ts > now() - interval '24 hours' GROUP BY 1,2 ORDER BY 2`,
      [ids],
    );
    const incidents = await pool.query(
      `SELECT i.monitor_id, m.name, i.started_at, i.resolved_at
       FROM incidents i JOIN monitors m ON m.id = i.monitor_id
       WHERE i.monitor_id = ANY($1) AND i.started_at > now() - interval '30 days' ORDER BY i.started_at DESC LIMIT 30`,
      [ids],
    );
    const anyDown = monitors.rows.some((m) => m.status === 'down');
    const body = {
      title: page.rows[0].title,
      overall: anyDown ? 'degraded' : 'operational',
      monitors: monitors.rows.map((m) => ({
        ...m,
        daily: daily.rows.filter((d) => d.monitor_id === m.id).map(({ day, total, ok }) => ({ day, total, ok })),
        latency: latency.rows.filter((l) => l.monitor_id === m.id).map(({ t, ms }) => ({ t, ms })),
      })),
      incidents: incidents.rows,
    };
    cache.set(slug, { at: Date.now(), body });
    return body;
  });
}
