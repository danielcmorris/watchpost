import { useEffect, useState } from 'react';
import { api } from '../api';

const MIN = 10;

export default function Profile() {
  const [username, setUsername] = useState('');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api<{ user: string }>('/api/auth/me').then((r) => setUsername(r.user)); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDone(false);
    if (next.length < MIN) return setErr(`Use at least ${MIN} characters for the new password.`);
    if (next !== confirm) return setErr('The new passwords don’t match.');
    setBusy(true);
    try {
      await api('/api/auth/password', 'POST', { current_password: current, new_password: next });
      setErr(''); setDone(true); setCurrent(''); setNext(''); setConfirm('');
    } catch (x) { setErr((x as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <>
      <div className="pagehead">
        <div className="grow"><h1>Profile</h1><p className="muted">Signed in as <strong>{username}</strong>.</p></div>
      </div>
      <form className="card" style={{ maxWidth: 480 }} onSubmit={submit}>
        <h3 style={{ marginBottom: 14 }}>Change password</h3>
        <label>Current password<input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required /></label>
        <label>New password<input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" minLength={MIN} required /></label>
        <label>Confirm new password<input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required /></label>
        <p className="muted" style={{ margin: '0 0 14px' }}>At least {MIN} characters. Changing it signs you out of any other devices.</p>
        {err && <p className="err" role="alert">{err}</p>}
        {done && <p role="status" style={{ color: 'var(--up)', fontWeight: 600, margin: '0 0 12px' }}>Password changed.</p>}
        <button className="primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Change password'}</button>
      </form>
    </>
  );
}
