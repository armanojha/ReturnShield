import {
  NavLink,
  Outlet,
  useLocation,
} from 'react-router-dom';

import { HealthIndicator } from './HealthIndicator';

function icon(d: string): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path d={d} />
    </svg>
  );
}

const operationsNavigation = [
  {
    to: '/ops',
    label: 'Overview',
    icon: 'M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6v-9h-6v9Zm0-16v5h6V4h-6Z',
  },
  {
    to: '/ops#queue',
    label: 'Risk queue',
    icon: 'M4 5h16M4 12h16M4 19h10',
  },
  {
    to: '/ops/cases',
    label: 'Cases',
    icon: 'M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm3 4h6M9 12h6M9 16h4',
  },
];

export function Layout(): JSX.Element {
  const { pathname } = useLocation();

  const isOperationsArea =
    pathname.startsWith('/ops');

  if (!isOperationsArea) {
    return (
      <div className="market-shell">
        <header className="market-header">
          <NavLink
            to="/marketplace"
            className="brand"
          >
            <span
              className="brand-mark"
              aria-hidden="true"
            >
              R
            </span>

            <span>
              ReturnShield
            </span>
          </NavLink>

          <nav aria-label="Marketplace">
            <NavLink to="/marketplace">
              ListingGuard
            </NavLink>

            <NavLink to="/marketplace/return">
              Request return
            </NavLink>

            <NavLink to="/marketplace/track">
              Track return
            </NavLink>

            <NavLink
              to="/ops"
              className="button-secondary"
            >
              Operations Center
            </NavLink>

            <HealthIndicator />
          </nav>
        </header>

        <main
          id="main"
          className="market-main"
        >
          <Outlet />
        </main>

        <footer className="market-footer">
          ReturnShield
        </footer>
      </div>
    );
  }

  return (
    <div className="ops-shell">
      <aside className="sidebar">
        <NavLink
          to="/ops"
          className="sidebar-brand"
          aria-label="ReturnShield Operations Center"
        >
          <span
            className="brand-mark"
            aria-hidden="true"
          >
            R
          </span>

          <div>
            <strong>
              ReturnShield
            </strong>

            <small>
              Operations Center
            </small>
          </div>
        </NavLink>

        <div className="workspace">
          <span>
            OPERATIONS
          </span>

          <strong>
            ReturnShield
          </strong>
        </div>

        <nav
          className="side-nav"
          aria-label="Operations"
        >
          {operationsNavigation.map(
            (item) => (
              <NavLink
                key={item.label}
                to={item.to}
                end={item.to === '/ops'}
                className={({
                  isActive,
                }) =>
                  isActive
                    ? 'active'
                    : ''
                }
              >
                {icon(item.icon)}

                <span>
                  {item.label}
                </span>
              </NavLink>
            ),
          )}
        </nav>

        <div className="sidebar-spacer" />

        <div
          className="policy-card"
          aria-label="ReturnShield service status"
        >
          <span
            className="pulse"
            aria-hidden="true"
          />

          <span>
            ReturnShield service
          </span>

          <small>
            Status shown above from the live health check.
          </small>
        </div>
      </aside>

      <div className="ops-workspace">
        <header className="topbar">
          <div className="search">
            {icon(
              'M21 21l-4.35-4.35M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
            )}

            <span>
              Search cases, sellers, orders…
            </span>

            <kbd>
              /
            </kbd>
          </div>

          <div className="topbar-actions">
            <HealthIndicator />

            <button
              type="button"
              className="icon-button"
              aria-label="Notifications"
              title="Notifications"
              disabled
            >
              {icon(
                'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',
              )}
            </button>
          </div>
        </header>

        <main
          id="main"
          className="ops-main"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default Layout;
