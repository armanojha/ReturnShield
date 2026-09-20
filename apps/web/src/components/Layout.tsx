import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { HealthIndicator } from './HealthIndicator';

const icon = (d: string) => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d={d} />
  </svg>
);
const opsNav = [
  {
    to: '/ops',
    label: 'Overview',
    icon: 'M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6v-9h-6v9Zm0-16v5h6V4h-6Z',
  },
  { to: '/ops#queue', label: 'Risk queue', icon: 'M4 5h16M4 12h16M4 19h10' },
  { to: '/marketplace', label: 'Marketplace', icon: 'M3 9l2-5h14l2 5M5 13v7h14v-7M9 20v-5h6v5' },
];
export function Layout(): JSX.Element {
  const { pathname } = useLocation(),
    isOps = pathname.startsWith('/ops');
  if (!isOps)
    return (
      <div className="market-shell">
        <header className="market-header">
          <NavLink to="/marketplace" className="brand">
            <span className="brand-mark">R</span>
            <span>ReturnShield</span>
          </NavLink>
          <nav>
            <NavLink to="/marketplace">List product</NavLink>
            <NavLink to="/marketplace/return">Request return</NavLink>
            <NavLink to="/marketplace/track">Track return</NavLink>
            <NavLink to="/ops" className="button-secondary">
              Operations console
            </NavLink>
            <HealthIndicator />
          </nav>
        </header>
        <main id="main" className="market-main">
          <Outlet />
        </main>
        <footer className="market-footer">
          ReturnShield · Synthetic demonstration environment
        </footer>
      </div>
    );
  return (
    <div className="ops-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-mark">R</span>
          <div>
            <strong>ReturnShield</strong>
            <small>Trust operations</small>
          </div>
        </div>
        <div className="workspace">
          <span>WORKSPACE</span>
          <strong>Golden Hour Code</strong>
        </div>
        <nav className="side-nav" aria-label="Primary">
          <span className="visually-hidden">Operations</span>
          {opsNav.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              end={item.to === '/ops'}
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              {icon(item.icon)}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <div className="policy-card">
          <span className="pulse" />
          Policy engine online<small>v1.0.0 · deterministic</small>
        </div>
        <div className="user-card">
          <span className="avatar">AR</span>
          <div>
            <strong>Analyst review</strong>
            <small>Demo reviewer</small>
          </div>
          <span>•••</span>
        </div>
      </aside>
      <div className="ops-workspace">
        <header className="topbar">
          <div className="search">
            {icon('M21 21l-4.35-4.35M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z')}
            <span>Search cases, sellers, orders…</span>
            <kbd>⌘ K</kbd>
          </div>
          <div className="topbar-actions">
            <HealthIndicator />
            <button className="icon-button" aria-label="Notifications">
              {icon('M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4')}
            </button>
          </div>
        </header>
        <main id="main" className="ops-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
