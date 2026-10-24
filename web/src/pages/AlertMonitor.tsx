import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Mark, Pill, Status, type State } from '../components/Mark';
import { UptimeBars } from './PublicStatus';

interface AlertView {
  monitor: { id: number; name: string; type: string; status: State; paused: boolean; last_check_at: string | null };
  summary: { uptime_24h: number | null; avg_latency_ms: number | null };
  daily: { day: string; total: number; ok: number }[];
  incidents: { started_at: string; resolved_at: string | null; cause: string | null }[];
}

const when = (value: string) => new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

export default function AlertMonitor() {
  const { id } = useParams();
  const { hash } = useLocation();
  const token = new URLSearchParams(hash.slice(1)).get('t');
  const [view, setView] = useState<AlertView | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) { setError('This alert link is invalid or has expired.'); return; }
    const load = () => fetch(`/api/alert/monitors/${id}`, {
      headers: { authorization: `Bearer ${token}` }, credentials: 'same-origin',
    }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not open this alert.');
      setView(data as AlertView);
      setError('');
    }).catch((err: Error) => setError(err.message));
    void load();
    const timer = setInterval(load, 60_000);
    return () => clearInterval(timer);
  }, [id, token]);

  if (error) return <div className="public"><div className="brandline"><Mark size={20} />Watchpost</div><h1>Link unavailable</h1><p>{error}</p><p><Link to="/login">Sign in to Watchpost</Link></p></div>;
  if (!view) return null;

  const m = view.monitor;
  const state: State = m.paused ? 'paused' : m.status;
  return (
    <div className="public">
      <div className="brandline"><Mark state={state} size={20} />Watchpost alert</div>
      <div className="headline"><h1>{m.name}</h1><Pill state={state} /></div>
      <p className="muted">Read-only monitor view from your alert email.</p>
      <div className="facts">
        <div><b>{view.summary.uptime_24h == null ? '–' : `${view.summary.uptime_24h}%`}</b><span>uptime, last 24 hours</span></div>
        <div><b>{view.summary.avg_latency_ms == null ? '–' : `${view.summary.avg_latency_ms} ms`}</b><span>average response</span></div>
        <div><b>{m.last_check_at ? when(m.last_check_at) : '–'}</b><span>last check</span></div>
      </div>
      <section className="site"><h2>Last 90 days</h2><UptimeBars daily={view.daily} /></section>
      <h2>Recent incidents</h2>
      {view.incidents.length === 0 ? <p>No incidents recorded.</p> : (
        <ul className="timeline">
          {view.incidents.map((incident, idx) => (
            <li key={idx}>
              <Status state={incident.resolved_at ? 'up' : 'down'} />
              <span>{incident.cause ?? 'Check failed'}</span>
              <span className="when">{when(incident.started_at)}, {incident.resolved_at ? `resolved ${when(incident.resolved_at)}` : 'still down'}</span>
            </li>
          ))}
        </ul>
      )}
      <footer className="muted">This alert link expires after 7 days. <Link to="/login">Sign in</Link> to manage monitors.</footer>
    </div>
  );
}
