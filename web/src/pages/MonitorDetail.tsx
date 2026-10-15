import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, type Monitor } from '../api';
import { Pill, Status, stateOf } from '../components/Mark';
import { UptimeBars } from './PublicStatus';

interface Detail {
  monitor: Monitor;
  checks: { ts: string; ok: boolean; latency_ms: number | null; error: string | null }[];
  incidents: { id: number; started_at: string; resolved_at: string | null; cause: string }[];
  daily: { day: string; total: number; ok: number }[];
}

const when = (s: string) => new Date(s).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

export default function MonitorDetail() {
  const { id } = useParams();
  const [d, setD] = useState<Detail | null>(null);
  useEffect(() => {
    const load = () => api<Detail>(`/api/monitors/${id}`).then(setD);
    void load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [id]);
  if (!d) return null;

  const m = d.monitor;
  const state = stateOf(m);
  const ok = d.checks.filter((c) => c.ok && c.latency_ms != null);
  const pts = ok.map((c) => ({ t: new Date(c.ts).getTime(), ms: c.latency_ms }));
  const uptime = d.checks.length ? (100 * d.checks.filter((c) => c.ok).length) / d.checks.length : null;
  const avg = ok.length ? Math.round(ok.reduce((a, c) => a + (c.latency_ms ?? 0), 0) / ok.length) : null;
  const last = d.checks[d.checks.length - 1];

  return (
    <>
      <p style={{ margin: '0 0 18px' }}><Link to="/">All monitors</Link></p>
      <div className="headline"><h1>{m.name}</h1><Pill state={state} /></div>
      <p className="muted" style={{ margin: '6px 0 0', wordBreak: 'break-all' }}>{m.target}{m.config.port ? `:${m.config.port}` : ''}</p>

      <div className="facts">
        <div><b>{uptime == null ? '–' : `${uptime.toFixed(2)}%`}</b><span>uptime, last 24 hours</span></div>
        <div><b>{avg == null ? '–' : `${avg} ms`}</b><span>average response</span></div>
        <div><b>{last ? new Date(last.ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '–'}</b><span>last check{last && !last.ok && last.error ? ` (failed)` : ''}</span></div>
      </div>

      <section className="card">
        <h3>Response time, last 24 hours</h3>
        {pts.length === 0 ? <p className="muted">No successful checks yet.</p> : (
          <div style={{ height: 220, marginTop: 12 }}>
            <ResponsiveContainer>
              <LineChart data={pts}>
                <CartesianGrid stroke="var(--rule)" vertical={false} />
                <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} scale="time" stroke="var(--muted)" tickLine={false} minTickGap={48}
                  tickFormatter={(v) => new Date(v).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} />
                <YAxis unit=" ms" stroke="var(--muted)" width={58} tickLine={false} axisLine={false} />
                <Tooltip labelFormatter={(v) => new Date(v as number).toLocaleString()} formatter={(v) => [`${v} ms`, 'Response']}
                  contentStyle={{ background: 'var(--panel)', border: '1px solid var(--rule)', borderRadius: 6, color: 'var(--ink)' }} />
                <Line dataKey="ms" stroke="var(--accent)" dot={false} strokeWidth={2} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="card">
        <h3>Last 90 days</h3>
        <UptimeBars daily={d.daily} />
      </section>

      <section className="card">
        <h3>Incidents</h3>
        {d.incidents.length === 0 ? <p className="muted" style={{ margin: '8px 0 0' }}>No incidents recorded.</p> : (
          <ul className="timeline">
            {d.incidents.map((i) => (
              <li key={i.id}>
                <Status state={i.resolved_at ? 'up' : 'down'} />
                <span>{i.cause}</span>
                <span className="when">{when(i.started_at)}, {i.resolved_at ? `resolved ${when(i.resolved_at)}` : 'still down'}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
