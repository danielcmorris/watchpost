function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

export const config = {
  port: Number(process.env.PORT ?? 4250),
  databaseUrl: req('DATABASE_URL'),
  sessionSecret: req('SESSION_SECRET'),
  adminUsername: process.env.ADMIN_USERNAME ?? 'admin',
  adminPassword: process.env.ADMIN_PASSWORD,
  publicUrl: process.env.PUBLIC_URL ?? 'http://localhost:4250',
  secureCookies: (process.env.PUBLIC_URL ?? '').startsWith('https://'),
  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 465),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
  },
  scheduler: {
    tickMs: 1000,
    maxConcurrent: 50,
    batch: 50,
    retentionDays: 90,
  },
};
