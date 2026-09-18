import { NavLink, Outlet } from 'react-router-dom';

import { HealthIndicator } from './HealthIndicator';

const NAV = [
  { to: '/marketplace', label: 'Marketplace' },
  { to: '/ops', label: 'Operations' },
] as const;

/** Shared chrome for every route: skip link, header, navigation and footer. */
export function Layout(): JSX.Element {
  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to main content
      </a>

      <header className="app__header">
        <div className="app__brand">
          <span className="app__mark" aria-hidden="true" />
          <span className="app__name">ReturnShield</span>
        </div>

        <nav className="app__nav" aria-label="Primary">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? 'app__link app__link--active' : 'app__link')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <HealthIndicator />
      </header>

      <main id="main" className="app__main">
        <Outlet />
      </main>

      <footer className="app__footer">
        <p>
          Synthetic demonstration data only. Risk signals indicate that a case needs review; they
          are not accusations of fraud.
        </p>
      </footer>
    </div>
  );
}
