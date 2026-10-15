# Watchpost

A self-hosted uptime monitor: one container, one Postgres database. Watchpost checks your websites, servers and ports on a schedule, emails you when something stops responding, and publishes status pages for your users.

Watchpost is an independent open-source project. It is not affiliated with or endorsed by UptimeRobot or any other monitoring service; all trademarks belong to their owners.

- **Monitors:** HTTP(S) status, keyword present/absent, ping (ICMP), TCP port, SSL certificate expiry
- **Alerts:** email on down / recovery / certificate problems (configurable failures-before-down to avoid flapping)
- **Status pages:** public pages with 24h/7d/30d uptime, a 90-day uptime bar, and recent incidents
- **UI:** admin dashboard with response-time charts and incident history · single local admin login

## Quick start (Docker)

```bash
git clone https://github.com/danielcmorris/watchpost.git && cd watchpost
cp .env.example .env
# edit .env: set SESSION_SECRET (openssl rand -hex 32), ADMIN_PASSWORD, POSTGRES_PASSWORD
# and put the same password in DATABASE_URL

docker compose --profile with-db up -d --build     # app + bundled Postgres
# or, with your own Postgres:  docker compose up -d --build
```

Open `http://localhost:4250` and sign in as `ADMIN_USERNAME` / `ADMIN_PASSWORD`. The database schema is created
automatically on startup, and the admin user is created on first start only (change the password in `.env`
afterwards and it will not be applied — see "Admin password" below).

### Using your own Postgres

Create a database and role, then point `DATABASE_URL` at it and omit `--profile with-db`:

```sql
CREATE ROLE watchpost LOGIN PASSWORD '<password>';
CREATE DATABASE watchpost OWNER watchpost;
```

`DATABASE_URL=postgres://watchpost:<password>@<host>:5432/watchpost`

## Configuration (`.env`)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string |
| `SESSION_SECRET` | yes | Random string (`openssl rand -hex 32`) |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | first start | Admin account, created only if no users exist |
| `PUBLIC_URL` | no | URL users reach the app at. `https://…` enables Secure cookies |
| `HOST_PORT` | no | Docker host port (default `4250`) |
| `SMTP_HOST` `SMTP_PORT` `SMTP_USER` `SMTP_PASS` `SMTP_FROM` | no | Email alerts. Port 465 uses implicit TLS. Without these, alerts are only logged |
| `POSTGRES_USER` `POSTGRES_PASSWORD` `POSTGRES_DB` | with bundled DB | Credentials for the `db` service |

Alerts go to the contacts attached to a monitor, or to **all** contacts if a monitor has none selected.
Add contacts under **Contacts**.

## HTTPS with a reverse proxy

Put the app behind nginx, Caddy, Traefik, etc. and set `PUBLIC_URL=https://your.domain`.
An nginx example is in [`deploy/nginx.conf.example`](deploy/nginx.conf.example). The app trusts `X-Forwarded-*` headers,
so keep it reachable only through the proxy (firewall the published port).

## Notes

- **Ping monitors** need the `NET_RAW` capability (already set in `docker-compose.yml`).
- **Checks run from wherever the container runs.** A monitor for something only visible from another network will fail.
- **Retention:** raw check results are kept 90 days; daily rollups are kept indefinitely.
- **Admin password:** the admin is only seeded when the `users` table is empty. To reset it, delete the user row
  (`DELETE FROM users;`) and restart with a new `ADMIN_PASSWORD`.
- **Status pages** expose only monitor names, status, uptime and incident times — never targets or settings.
- Sign-in is rate limited, sessions are stored hashed, and only one admin account is supported.

## Importing from UptimeRobot

```bash
UPTIMEROBOT_API_KEY=... ADMIN_PASSWORD=... TARGET=http://localhost:4250 \
  node scripts/import-uptimerobot.mjs --dry-run     # drop --dry-run to import
```

Watchpost can import your existing UptimeRobot setup. It brings across HTTP, keyword, ping and port monitors and email contacts (SMS, voice and other contact types are skipped).
Safe to re-run: monitors with an existing name are skipped. Needs Node 20+.

## Development

```bash
npm install
export DATABASE_URL=... SESSION_SECRET=... ADMIN_PASSWORD=... PORT=4251
npm run dev:server            # API + scheduler (migrates the DB on start)
npm -w web run dev            # UI on :5173, proxies /api to :4251
npm test
```

Layout: `server/` (Fastify API, scheduler, checkers, SQL migrations) · `web/` (React + Vite) · `deploy/` (example configs) · `scripts/`.

## License

MIT — see [LICENSE](LICENSE).
