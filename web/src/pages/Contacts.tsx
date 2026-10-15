import { useCallback, useEffect, useState } from 'react';
import { api, type Contact } from '../api';

export default function Contacts() {
  const [list, setList] = useState<Contact[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [err, setErr] = useState('');
  const load = useCallback(async () => setList(await api<Contact[]>('/api/contacts')), []);
  useEffect(() => { void load(); }, [load]);
  return (
    <>
      <div className="pagehead"><div className="grow"><h1>Contacts</h1><p className="muted">Who gets an email when a monitor goes down or recovers. A monitor with no contacts selected emails everyone listed here.</p></div></div>
      <div className="card">
        <div className="grid2">
          <label>Name<input value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        </div>
        {err && <p className="err">{err}</p>}
        <button className="primary" onClick={async () => {
          try { await api('/api/contacts', 'POST', { name, email }); setName(''); setEmail(''); setErr(''); await load(); }
          catch (e) { setErr((e as Error).message); }
        }}>Add contact</button>
      </div>
      {list.map((c) => (
        <div className="card row" key={c.id}>
          <strong>{c.name}</strong><span className="muted grow">{c.email}</span>
          <button className="danger" onClick={async () => { await api(`/api/contacts/${c.id}`, 'DELETE'); await load(); }}>Remove</button>
        </div>
      ))}
    </>
  );
}
