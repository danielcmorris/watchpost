import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../auth.js';
import { pool } from '../db/pool.js';

const contactBody = z.object({ name: z.string().min(1).max(200), email: z.string().email().max(320) });
const pageBody = z.object({
  slug: z.string().regex(/^[a-z0-9-]{1,60}$/),
  title: z.string().min(1).max(200),
  monitor_ids: z.array(z.number().int()).default([]),
});
const idParam = z.object({ id: z.coerce.number().int() });

export function adminRoutes(app: FastifyInstance): void {
  const guard = { preHandler: requireAuth };

  app.get('/api/contacts', guard, async () => (await pool.query('SELECT id,name,email FROM alert_contacts ORDER BY name')).rows);
  app.post('/api/contacts', guard, async (req, reply) => {
    const b = contactBody.safeParse(req.body);
    if (!b.success) return reply.code(400).send({ error: b.error.flatten() });
    const { rows } = await pool.query('INSERT INTO alert_contacts (name,email) VALUES ($1,$2) RETURNING id', [b.data.name, b.data.email]);
    return reply.code(201).send({ id: rows[0].id });
  });
  app.delete('/api/contacts/:id', guard, async (req, reply) => {
    const p = idParam.safeParse(req.params);
    if (!p.success) return reply.code(400).send({ error: 'Invalid request' });
    await pool.query('DELETE FROM alert_contacts WHERE id=$1', [p.data.id]);
    return { ok: true };
  });

  app.get('/api/status-pages', guard, async () => (await pool.query(
    `SELECT p.id, p.slug, p.title,
            COALESCE((SELECT array_agg(monitor_id ORDER BY position) FROM status_page_monitors s WHERE s.page_id=p.id),'{}') AS monitor_ids
     FROM status_pages p ORDER BY p.title`)).rows);

  const savePage = async (id: number | null, d: z.infer<typeof pageBody>) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const pid = id ?? (await client.query('INSERT INTO status_pages (slug,title) VALUES ($1,$2) RETURNING id', [d.slug, d.title])).rows[0].id;
      if (id) await client.query('UPDATE status_pages SET slug=$2,title=$3 WHERE id=$1', [id, d.slug, d.title]);
      await client.query('DELETE FROM status_page_monitors WHERE page_id=$1', [pid]);
      for (const [i, mid] of d.monitor_ids.entries()) {
        await client.query('INSERT INTO status_page_monitors (page_id,monitor_id,position) VALUES ($1,$2,$3)', [pid, mid, i]);
      }
      await client.query('COMMIT');
      return pid as number;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  };

  app.post('/api/status-pages', guard, async (req, reply) => {
    const b = pageBody.safeParse(req.body);
    if (!b.success) return reply.code(400).send({ error: b.error.flatten() });
    try { return reply.code(201).send({ id: await savePage(null, b.data) }); }
    catch { return reply.code(409).send({ error: 'Slug already in use or invalid monitor' }); }
  });
  app.put('/api/status-pages/:id', guard, async (req, reply) => {
    const p = idParam.safeParse(req.params);
    const b = pageBody.safeParse(req.body);
    if (!p.success || !b.success) return reply.code(400).send({ error: 'Invalid request' });
    try { await savePage(p.data.id, b.data); return { ok: true }; }
    catch { return reply.code(409).send({ error: 'Slug already in use or invalid monitor' }); }
  });
  app.delete('/api/status-pages/:id', guard, async (req, reply) => {
    const p = idParam.safeParse(req.params);
    if (!p.success) return reply.code(400).send({ error: 'Invalid request' });
    await pool.query('DELETE FROM status_pages WHERE id=$1', [p.data.id]);
    return { ok: true };
  });
}
