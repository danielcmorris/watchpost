import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import { Mark, Pill, Status, type State } from '../components/Mark';

interface Daily { day: string; total: number; ok: number }
interface PubMonitor {
  id: number; name: string; status: string; uptime_24h: number | null; uptime_7d: number | null; uptime_30d: number | null; daily: Daily[];
}
interface PubPage {
  title: string; overall: 'operational' | 'degraded'; monitors: PubMonitor[];
  incidents: { monitor_id: number; name: string; started_at: string; resolved_at: string | null }[];
}

export function UptimeBars({ daily }: { daily: Daily[] }) {
  const byDay = new Map(daily.map((d) => [d.day.slice(0, 10), d]));
  const days = Array.from({ length: 90 }, (_, i) => {
    const dt = new Date(); dt.setDate(dt.getDate() - (89 - i));
    return dt.toISOString().slice(0, 10);
  });
  return (
    <>
      <div className="days" role="img" aria-label="Daily uptime for the last 90 days">
        {days.map((day) => {
          const d = byDay.get(day);
          const pct = d ? (100 * d.ok) / d.total : null;
          const cls = pct == null ? '' : pct >= 99.9 ? 'g' : pct >= 95 ? 'y' : 'r';
          return <span key={day} className={cls} title={`${day}: ${pct == null ? 'no data' : pct.toFixed(2) + '% up'}`} />;
        })}
      </div>
      <div className="axis muted"><span>90 days ago</span><span>Today</span></div>
    </>
  );
}

const pct = (v: number | null) => (v == null ? '–' : `${v}%`);
const when = (s: string) => new Date(s).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

export default function PublicStatus() {
  const { slug } = useParams();
  const [p, setP] = useState<PubPage | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    const load = () => api<PubPage>(`/api/public/status/${slug}`).then(setP, () => setMissing(true));
    void load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [slug]);
  useEffect(() => { if (p) document.title = p.title; }, [p]);

  if (missing) return <div className="public"><h1>Page not found</h1><p className="muted">This status page doesn't exist or has been removed.</p></div>;
  if (!p) return null;

  const downCount = p.monitors.filter((m) => m.status === 'down').length;
  const state: State = downCount ? 'down' : 'up';
  return (
    <div className="public">
      <div className="brandline"><Mark state={state} size={20} />{p.title}</div>
      <div className={`headline ${state}`}>
        <Status state={state} size={20} />
        <h1>{downCount ? `${downCount} of ${p.monitors.length} services ${downCount === 1 ? 'is' : 'are'} down` : 'Everything is running'}</h1>
      </div>

      <div style={{ marginTop: 32 }}>
        {p.monitors.map((m) => (
          <section className="site" key={m.id}>
            <div className="row">
              <strong className="grow">{m.name}</strong>
              <span className="muted">{pct(m.uptime_30d)} over 30 days</span>
              <Pill state={m.status as State} />
            </div>
            <UptimeBars daily={m.daily} />
            <p className="muted" style={{ margin: '8px 0 0' }}>{pct(m.uptime_24h)} in the last 24 hours, {pct(m.uptime_7d)} in the last 7 days</p>
          </section>
        ))}
      </div>

      <h2>Past incidents</h2>
      <p className="muted" style={{ margin: '0 0 8px' }}>The last 30 days.</p>
      {p.incidents.length === 0 ? <p>No incidents.</p> : (
        <ul className="timeline">
          {p.incidents.map((i, idx) => (
            <li key={idx}>
              <Status state={i.resolved_at ? 'up' : 'down'} />
              <strong>{i.name}</strong>
              <span className="when">{when(i.started_at)}, {i.resolved_at ? `resolved ${when(i.resolved_at)}` : 'still down'}</span>
            </li>
          ))}
        </ul>
      )}
      <footer className="muted">Monitoring by Watchpost</footer>
    </div>
  );
}
