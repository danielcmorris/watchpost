import nodemailer from 'nodemailer';
import { config } from './config.js';
import { pool } from './db/pool.js';
import type { AlertMessage } from './emails.js';

const transport = config.smtp.host && config.smtp.user && config.smtp.from
  ? nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      requireTLS: config.smtp.port !== 465, // never fall back to plaintext on STARTTLS ports (587)
      name: new URL(config.publicUrl).hostname, // EHLO name; default is the container ID
      auth: { user: config.smtp.user, pass: config.smtp.pass },
    })
  : null;

/** Contacts attached to the monitor; falls back to all contacts if none attached. */
export async function recipientsFor(monitorId: number): Promise<string[]> {
  const specific = await pool.query(
    'SELECT c.email FROM alert_contacts c JOIN monitor_contacts mc ON mc.contact_id = c.id WHERE mc.monitor_id = $1',
    [monitorId],
  );
  if (specific.rows.length) return specific.rows.map((r) => r.email);
  const all = await pool.query('SELECT email FROM alert_contacts');
  return all.rows.map((r) => r.email);
}

export async function sendAlert(monitorId: number, msg: AlertMessage): Promise<void> {
  const { subject, text, html } = msg;
  const to = await recipientsFor(monitorId);
  if (!to.length) return;
  if (!transport) {
    console.warn(`[mail] SMTP not configured; would send "${subject}" to ${to.join(', ')}`);
    return;
  }
  try {
    const info = await transport.sendMail({ from: `Watchpost <${config.smtp.from}>`, to, subject, text, html });
    console.log(`[mail] "${subject}" accepted=${info.accepted.join(',')} rejected=${info.rejected.join(',')} response=${info.response}`);
  } catch (e) {
    console.error('[mail] send failed', e);
  }
}
