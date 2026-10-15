-- Up Migration
CREATE TABLE users (
  id serial PRIMARY KEY,
  username text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id text PRIMARY KEY,
  user_id int NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);

CREATE TABLE monitors (
  id serial PRIMARY KEY,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('http','keyword','ping','tcp','ssl')),
  target text NOT NULL,
  interval_s int NOT NULL DEFAULT 60 CHECK (interval_s >= 30),
  timeout_s int NOT NULL DEFAULT 10 CHECK (timeout_s BETWEEN 1 AND 60),
  config jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','up','down')),
  paused boolean NOT NULL DEFAULT false,
  consecutive_failures int NOT NULL DEFAULT 0,
  failure_threshold int NOT NULL DEFAULT 2,
  next_check_at timestamptz NOT NULL DEFAULT now(),
  last_check_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX monitors_due ON monitors (next_check_at) WHERE NOT paused;

CREATE TABLE checks (
  id bigserial PRIMARY KEY,
  monitor_id int NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  ts timestamptz NOT NULL DEFAULT now(),
  ok boolean NOT NULL,
  latency_ms int,
  status_code int,
  error text
);
CREATE INDEX checks_monitor_ts ON checks (monitor_id, ts DESC);

CREATE TABLE check_daily (
  monitor_id int NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  day date NOT NULL,
  total int NOT NULL,
  ok int NOT NULL,
  avg_latency_ms int,
  PRIMARY KEY (monitor_id, day)
);

CREATE TABLE incidents (
  id serial PRIMARY KEY,
  monitor_id int NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  cause text
);
CREATE INDEX incidents_monitor ON incidents (monitor_id, started_at DESC);

CREATE TABLE alert_contacts (
  id serial PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL
);
CREATE TABLE monitor_contacts (
  monitor_id int REFERENCES monitors(id) ON DELETE CASCADE,
  contact_id int REFERENCES alert_contacts(id) ON DELETE CASCADE,
  PRIMARY KEY (monitor_id, contact_id)
);

CREATE TABLE status_pages (
  id serial PRIMARY KEY,
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  custom_domain text
);
CREATE TABLE status_page_monitors (
  page_id int REFERENCES status_pages(id) ON DELETE CASCADE,
  monitor_id int REFERENCES monitors(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  PRIMARY KEY (page_id, monitor_id)
);

-- Down Migration
DROP TABLE status_page_monitors, status_pages, monitor_contacts, alert_contacts, incidents, check_daily, checks, monitors, sessions, users;
