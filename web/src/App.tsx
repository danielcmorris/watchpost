import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { api, type Monitor } from './api';
import { Mark } from './components/Mark';
import Contacts from './pages/Contacts';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import MonitorDetail from './pages/MonitorDetail';
import Profile from './pages/Profile';
import PublicStatus from './pages/PublicStatus';
import StatusPages from './pages/StatusPages';

function Admin({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<'loading' | 'in' | 'out'>('loading');
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const nav = useNavigate();

  useEffect(() => { api('/api/auth/me').then(() => setAuth('in'), () => setAuth('out')); }, []);
  useEffect(() => {
    if (auth !== 'in') return;
    const load = () => api<Monitor[]>('/api/monitors').then(setMonitors, () => {});
    void load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [auth]);

  if (auth === 'loading') return null;
  if (auth === 'out') return <Navigate to="/login" replace />;

  const active = monitors.filter((m) => !m.paused);
  const down = active.filter((m) => m.status === 'down').length;
  const up = active.filter((m) => m.status === 'up').length;
  return (
    <div className="shell">
      <aside className="rail">
        <Link to="/" className="brand"><Mark state={down ? 'down' : 'up'} />Watchpost</Link>
        <nav aria-label="Main">
          <NavLink to="/" end>Monitors</NavLink>
          <NavLink to="/contacts">Contacts</NavLink>
          <NavLink to="/status-pages">Status pages</NavLink>
          <NavLink to="/profile">Profile</NavLink>
        </nav>
        <div className="foot">
          {active.length > 0 && <span className="muted">{up} of {active.length} up</span>}
          <button className="link" onClick={async () => { await api('/api/auth/logout', 'POST'); nav('/login'); }}>Sign out</button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/status/:slug" element={<PublicStatus />} />
      <Route path="/" element={<Admin><Dashboard /></Admin>} />
      <Route path="/monitors/:id" element={<Admin><MonitorDetail /></Admin>} />
      <Route path="/contacts" element={<Admin><Contacts /></Admin>} />
      <Route path="/status-pages" element={<Admin><StatusPages /></Admin>} />
      <Route path="/profile" element={<Admin><Profile /></Admin>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
