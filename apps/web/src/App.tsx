import {
  Link,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom';

import { Layout } from './components/Layout';

import { MarketplaceRoute } from './routes/MarketplaceRoute';
import { OpsRoute } from './routes/OpsRoute';
import { CaseRoute } from './routes/CaseRoute';
import { ListingRoute } from './routes/ListingRoute';
import { SellerRoute } from './routes/SellerRoute';

function NotFoundRoute(): JSX.Element {
  return (
    <section className="page-shell">
      <div className="empty-card">
        <div className="empty-icon">404</div>

        <h1>Page not found</h1>

        <p>
          The requested ReturnShield page does not exist.
        </p>

        <Link
          className="button button--primary"
          to="/ops"
        >
          Open Operations Center
        </Link>
      </div>
    </section>
  );
}

export function App(): JSX.Element {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route
          index
          element={<Navigate to="/ops" replace />}
        />

        <Route
          path="/marketplace"
          element={<MarketplaceRoute />}
        />

        <Route
          path="/ops"
          element={<OpsRoute />}
        />

        <Route
          path="/ops/cases/:caseId"
          element={<CaseRoute />}
        />

        <Route
          path="/ops/listings/:listingId"
          element={<ListingRoute />}
        />

        <Route
          path="/ops/sellers/:sellerId"
          element={<SellerRoute />}
        />

        <Route
          path="*"
          element={<NotFoundRoute />}
        />
      </Route>
    </Routes>
  );
}

export default App;
