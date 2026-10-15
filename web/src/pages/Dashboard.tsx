import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Contact, type Monitor } from '../api';
import { Status, Ticks, stateOf } from '../components/Mark';
import MonitorForm from './MonitorForm';

const where = (m: Monitor) => (m.config.port ? `${m.target}:${m.config.port}` : m.target);

export default function Dashboard() {
  const [monitors, setMonitors] = useState<Monitor[] | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [editing, setEditing] = useState<Monitor | 'new' | null>(null);

  const load = useCallback(async () => {
    setMonitors(await api<Monitor[]>('/api/monitors'));
    setContacts(await api<Contact[]>('/api/contacts'));
  }, []);
  useEffect(() => { void load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);
  if (!monitors) return null;

  const active = monitors.filter((m) => !m.paused);
  const down = active.filter((m) => m.status === 'down');
  const headline = !monitors.length ? 'Nothing is being watched yet'
    : down.length ? `${down.length} ${down.length === 1 ? 'monitor is' : 'monitors are'} down`
    : 'Everything is running';

  return (
    <>
      <div className="pagehead">
        <div className="grow">
          <h1 style={down.length ? { color: 'var(--down)' } : undefined}>{headline}</h1>
          {down.length > 0 && <p className="muted">{down.map((m) => m.name).join(', ')}</p>}
        </div>
        <button className="primary" onClick={() => setEditing('new')}>Add monitor</button>
      </div>

      {editing && (
        <MonitorForm monitor={editing === 'new' ? null : editing} contacts={contacts}
          onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void load(); }} />
      )}

      {monitors.length === 0 && !editing ? (
        <div className="ledger empty">
          <p>Add a website, server or port and Watchpost will check it and email you when it stops responding.</p>
          <button className="primary" onClick={() => setEditing('new')}>Add your first monitor</button>
        </div>
      ) : (
        <div className="ledger">
          {monitors.map((m) => (
            <div className="item" key={m.id}>
              <span className="a-status"><Status state={stateOf(m)} /></span>
              <div className="a-name" style={{ minWidth: 0 }}>
                <Link className="name" to={`/monitors/${m.id}`}>{m.name}</Link>
                <div className="target" title={where(m)}>{where(m)}</div>
              </div>
              <div className="a-ticks"><Ticks values={m.recent ?? []} /></div>
              <div className="a-stats">
                <div className="stat"><b>{m.uptime_24h == null ? '–' : `${m.uptime_24h}%`}</b><span> uptime, 24h</span></div>
                <div className="stat"><b>{m.last_latency_ms == null ? '–' : `${m.last_latency_ms} ms`}</b><span> response</span></div>
              </div>
              <button className="a-edit" onClick={() => setEditing(m)}>Edit</button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
