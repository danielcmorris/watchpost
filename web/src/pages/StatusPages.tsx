import { useCallback, useEffect, useState } from 'react';
import { api, type Monitor, type StatusPage } from '../api';
import { Status, stateOf } from '../components/Mark';

export default function StatusPages() {
  const [pages, setPages] = useState<StatusPage[]>([]);
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [edit, setEdit] = useState<{ id?: number; slug: string; title: string; monitor_ids: number[] } | null>(null);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState<Set<number>>(new Set());
  const toggle = (id: number) => setOpen((o) => { const n = new Set(o); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const load = useCallback(async () => {
    setPages(await api<StatusPage[]>('/api/status-pages'));
    setMonitors(await api<Monitor[]>('/api/monitors'));
  }, []);
  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!edit) return;
    try {
      const body = { slug: edit.slug, title: edit.title, monitor_ids: edit.monitor_ids };
      if (edit.id) await api(`/api/status-pages/${edit.id}`, 'PUT', body);
      else await api('/api/status-pages', 'POST', body);
      setEdit(null); setErr(''); await load();
    } catch (e) { setErr((e as Error).message); }
  };

  return (
    <>
      <div className="pagehead">
        <div className="grow"><h1>Status pages</h1><p className="muted">Public pages that show visitors whether your services are up.</p></div>
        <button className="primary" onClick={() => setEdit({ slug: '', title: '', monitor_ids: [] })}>New status page</button>
      </div>
      {edit && (
        <div className="card">
          <div className="grid2">
            <label>Title<input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></label>
            <label>Slug (a-z, 0-9, -)<input value={edit.slug} onChange={(e) => setEdit({ ...edit, slug: e.target.value })} /></label>
          </div>
          <label>Monitors shown</label>
          {monitors.map((m) => (
            <label key={m.id} style={{ margin: '0 0 4px' }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={edit.monitor_ids.includes(m.id)}
                onChange={(e) => setEdit({ ...edit, monitor_ids: e.target.checked ? [...edit.monitor_ids, m.id] : edit.monitor_ids.filter((x) => x !== m.id) })} /> {m.name}
            </label>
          ))}
          {err && <p className="err">{err}</p>}
          <div className="row" style={{ marginTop: 10 }}><button className="primary" onClick={save}>Save</button><button onClick={() => setEdit(null)}>Cancel</button></div>
        </div>
      )}
      {pages.map((p) => {
        const shown = p.monitor_ids.map((id) => monitors.find((m) => m.id === id)).filter((m): m is Monitor => !!m);
        const down = shown.filter((m) => m.status === 'down').length;
        const isOpen = open.has(p.id);
        return (
          <div className="card" key={p.id}>
            <div className="row">
              <button className="chev" aria-expanded={isOpen} aria-label={isOpen ? 'Collapse' : 'Expand'} title={isOpen ? 'Hide monitors' : 'Show monitors'} onClick={() => toggle(p.id)}>
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
                  <path d="M3 6l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <a className="grow" href={`/status/${p.slug}`} target="_blank" rel="noreferrer" title="Open public status page">
                <strong>{p.title}</strong> <span className="muted">/status/{p.slug}</span>
              </a>
              <span className="muted">{shown.length} monitor{shown.length === 1 ? '' : 's'}{down ? `, ${down} down` : ''}</span>
              <button onClick={() => setEdit(p)}>Edit</button>
              <button className="danger" onClick={async () => { if (confirm(`Delete "${p.title}"?`)) { await api(`/api/status-pages/${p.id}`, 'DELETE'); await load(); } }}>Delete</button>
            </div>
            {isOpen && (
              <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                {shown.length === 0 && <span className="muted">No monitors on this page yet.</span>}
                {shown.map((m) => (
                  <div className="row" key={m.id} style={{ padding: '4px 0' }}>
                    <Status state={stateOf(m)} />
                    <span className="grow">{m.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
