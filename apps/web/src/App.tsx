import { Link, Navigate, Route, Routes } from 'react-router-dom';

import { Layout } from './components/Layout';
import { MarketplaceRoute } from './routes/MarketplaceRoute';
import { OpsRoute } from './routes/OpsRoute';
import { CaseDetail } from './features/ops/CaseDetail';
import { SellerProfile } from './features/ops/SellerProfile';
import { ReturnForm } from './features/returns/ReturnForm';
import { TrackReturn } from './features/returns/TrackReturn';

function NotFoundRoute(): JSX.Element {
  return (
    <article className="page">
      <p className="page__eyebrow">404</p>
      <h1 className="page__title">No such page</h1>
      <p className="page__lede">
        That route does not exist. Try the <Link to="/marketplace">marketplace</Link> or the{' '}
        <Link to="/ops">operations center</Link>.
      </p>
    </article>
  );
}

export function App(): JSX.Element {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/marketplace" replace />} />
        <Route path="marketplace" element={<MarketplaceRoute />} />
        <Route path="marketplace/return" element={<ReturnForm />} />
        <Route path="marketplace/track" element={<TrackReturn />} />
        <Route path="ops" element={<OpsRoute />} />
        <Route path="ops/cases/:caseId" element={<CaseDetail />} />
        <Route path="ops/sellers/:sellerId" element={<SellerProfile />} />
        <Route path="*" element={<NotFoundRoute />} />
      </Route>
    </Routes>
  );
}

export default App;
