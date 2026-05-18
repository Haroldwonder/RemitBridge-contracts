import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const links = [
  { to: '/dashboard', label: '🏠 Dashboard' },
  { to: '/recipients', label: '👥 Recipients' },
  { to: '/batches/new', label: '💸 New Batch' },
  { to: '/audit', label: '📋 Audit Trail' },
];

export default function Layout({ children }) {
  const { org, logout } = useAuth();
  const nav = useNavigate();

  function handleLogout() { logout(); nav('/login'); }

  return (
    <div className="flex min-h-screen bg-slate-900 text-white">
      <aside className="w-56 bg-slate-800 flex flex-col p-4 shrink-0">
        <div className="mb-8">
          <h1 className="text-lg font-bold text-indigo-400">RemitBridge</h1>
          <p className="text-xs text-slate-400 truncate">{org?.name}</p>
        </div>
        <nav className="flex-1 space-y-1">
          {links.map(l => (
            <NavLink
              key={l.to} to={l.to}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-lg text-sm transition ${isActive ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-700'}`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        <button onClick={handleLogout} className="text-slate-400 hover:text-white text-sm mt-4 text-left px-3 py-2 rounded-lg hover:bg-slate-700 transition">
          ↩ Sign out
        </button>
      </aside>
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  );
}
