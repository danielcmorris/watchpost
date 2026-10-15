import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { Mark } from '../components/Mark';

export default function Login() {
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [err, setErr] = useState('');
  const nav = useNavigate();
  return (
    <div className="signin">
      <form onSubmit={async (e) => {
        e.preventDefault();
        try { await api('/api/auth/login', 'POST', { username: u, password: p }); nav('/'); }
        catch (x) { setErr((x as Error).message === 'Invalid credentials' ? 'That username or password is wrong.' : (x as Error).message); }
      }}>
        <div className="brand"><Mark size={34} />Watchpost</div>
        <p className="muted">Sign in to manage your monitors.</p>
        <label>Username<input value={u} onChange={(e) => setU(e.target.value)} autoFocus autoComplete="username" /></label>
        <label>Password<input type="password" value={p} onChange={(e) => setP(e.target.value)} autoComplete="current-password" /></label>
        {err && <p className="err" role="alert">{err}</p>}
        <button className="primary" type="submit">Sign in</button>
      </form>
    </div>
  );
}
