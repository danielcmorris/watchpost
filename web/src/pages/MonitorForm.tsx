import { useState } from 'react';
import { api, type Contact, type Monitor } from '../api';

export default function MonitorForm({ monitor, contacts, onClose, onSaved }: {
  monitor: Monitor | null; contacts: Contact[]; onClose: () => void; onSaved: () => void;
}) {
  const [f, setF] = useState({
    name: monitor?.name ?? '', type: monitor?.type ?? 'http', target: monitor?.target ?? '',
    interval_s: monitor?.interval_s ?? 60, timeout_s: monitor?.timeout_s ?? 10,
    failure_threshold: monitor?.failure_threshold ?? 2, paused: monitor?.paused ?? false,
    port: monitor?.config.port ?? '', keyword: monitor?.config.keyword ?? '',
    keywordMode: monitor?.config.keywordMode ?? 'present',
    expectedStatus: monitor?.config.expectedStatus?.join(',') ?? '',
    sslWarnDays: monitor?.config.sslWarnDays ?? '',
    contact_ids: monitor?.contact_ids ?? [],
  });
  const [err, setErr] = useState('');
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF({ ...f, [k]: v });

  const save = async () => {
    const config: Record<string, unknown> = {};
    if (f.type === 'tcp' || f.type === 'ssl') { if (f.port !== '') config.port = Number(f.port); }
    if (f.type === 'keyword') { config.keyword = f.keyword; config.keywordMode = f.keywordMode; }
    if ((f.type === 'http' || f.type === 'keyword') && f.expectedStatus.trim())
      config.expectedStatus = f.expectedStatus.split(',').map((s) => Number(s.trim())).filter(Boolean);
    if (f.type === 'ssl' && f.sslWarnDays !== '') config.sslWarnDays = Number(f.sslWarnDays);
    const body = {
      name: f.name, type: f.type, target: f.target, interval_s: f.interval_s, timeout_s: f.timeout_s,
      failure_threshold: f.failure_threshold, paused: f.paused, config, contact_ids: f.contact_ids,
    };
    try {
      if (monitor) await api(`/api/monitors/${monitor.id}`, 'PUT', body);
      else await api('/api/monitors', 'POST', body);
      onSaved();
    } catch (e) { setErr((e as Error).message); }
  };

  return (
    <div className="card">
      <h3 style={{ marginBottom: 14 }}>{monitor ? 'Edit monitor' : 'New monitor'}</h3>
      <div className="grid2">
        <label>Name<input value={f.name} onChange={(e) => set('name', e.target.value)} /></label>
        <label>Type
          <select value={f.type} onChange={(e) => set('type', e.target.value as Monitor['type'])}>
            <option value="http">HTTP(S)</option><option value="keyword">Keyword</option>
            <option value="ping">Ping</option><option value="tcp">TCP port</option><option value="ssl">SSL expiry</option>
          </select>
        </label>
        <label>{f.type === 'http' || f.type === 'keyword' ? 'URL' : 'Host'}
          <input value={f.target} onChange={(e) => set('target', e.target.value)} placeholder={f.type === 'http' || f.type === 'keyword' ? 'https://example.com' : 'example.com'} /></label>
        {(f.type === 'tcp' || f.type === 'ssl') && <label>Port<input type="number" value={f.port} onChange={(e) => set('port', e.target.value)} placeholder={f.type === 'ssl' ? '443' : ''} /></label>}
        {f.type === 'keyword' && <>
          <label>Keyword<input value={f.keyword} onChange={(e) => set('keyword', e.target.value)} /></label>
          <label>Alert when keyword is
            <select value={f.keywordMode} onChange={(e) => set('keywordMode', e.target.value as 'present' | 'absent')}>
              <option value="present">missing</option><option value="absent">present</option>
            </select></label>
        </>}
        {(f.type === 'http' || f.type === 'keyword') && <label>Accepted status codes (blank = 2xx/3xx)<input value={f.expectedStatus} onChange={(e) => set('expectedStatus', e.target.value)} placeholder="200,204" /></label>}
        {f.type === 'ssl' && <label>Warn days before expiry<input type="number" value={f.sslWarnDays} onChange={(e) => set('sslWarnDays', e.target.value)} placeholder="14" /></label>}
        <label>Interval (s, min 30)<input type="number" min={30} value={f.interval_s} onChange={(e) => set('interval_s', Number(e.target.value))} /></label>
        <label>Timeout (s)<input type="number" min={1} max={60} value={f.timeout_s} onChange={(e) => set('timeout_s', Number(e.target.value))} /></label>
        <label>Failures before DOWN<input type="number" min={1} max={10} value={f.failure_threshold} onChange={(e) => set('failure_threshold', Number(e.target.value))} /></label>
      </div>
      <label>Alert contacts (none selected = all)</label>
      <div className="row" style={{ marginBottom: 10 }}>
        {contacts.map((c) => (
          <label key={c.id} style={{ margin: 0 }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={f.contact_ids.includes(c.id)}
              onChange={(e) => set('contact_ids', e.target.checked ? [...f.contact_ids, c.id] : f.contact_ids.filter((x) => x !== c.id))} /> {c.name}
          </label>
        ))}
      </div>
      <label><input type="checkbox" style={{ width: 'auto' }} checked={f.paused} onChange={(e) => set('paused', e.target.checked)} /> Paused</label>
      {err && <p className="err">{err}</p>}
      <div className="row">
        <button className="primary" onClick={save}>Save</button>
        <button onClick={onClose}>Cancel</button>
        {monitor && <button className="danger" style={{ marginLeft: 'auto' }} onClick={async () => {
          if (confirm(`Delete "${monitor.name}"?`)) { await api(`/api/monitors/${monitor.id}`, 'DELETE'); onSaved(); }
        }}>Delete</button>}
      </div>
    </div>
  );
}
