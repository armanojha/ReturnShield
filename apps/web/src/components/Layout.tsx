import {
  NavLink,
  Outlet,
} from 'react-router-dom';

import { HealthIndicator } from './HealthIndicator';

const NAV_ITEMS = [
  {
    to: '/ops',
    label: 'Operations',
  },
  {
    to: '/marketplace',
    label: 'Marketplace',
  },
];

export function Layout(): JSX.Element {
  return (
    <div className="app">
      <a
        href="#main"
        className="skip-link"
      >
        Skip to main content
      </a>

      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            RS
          </div>

          <div>
            <div className="brand-name">
              ReturnShield
            </div>

            <div className="brand-subtitle">
              Trust Intelligence
            </div>
          </div>
        </div>

        <nav
          className="navigation"
          aria-label="Primary navigation"
        >
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/ops'}
              className={({
                isActive,
              }) =>
                isActive
                  ? 'navigation-link navigation-link--active'
                  : 'navigation-link'
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <HealthIndicator />
      </header>

      <main
        id="main"
        className="main-content"
      >
        <Outlet />
      </main>

      <footer className="footer">
        <span>
          ReturnShield Trust Operations Center
        </span>

        <span>
          Evidence-based risk intelligence
        </span>
      </footer>
    </div>
  );
}
