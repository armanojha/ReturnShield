import { Link, Navigate, Route, Routes } from 'react-router-dom';

import { Layout } from './components/Layout';
import { MarketplaceRoute } from './routes/MarketplaceRoute';
import { OpsRoute } from './routes/OpsRoute';

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
        <Route path="ops" element={<OpsRoute />} />
        <Route path="*" element={<NotFoundRoute />} />
      </Route>
    </Routes>
  );
}

export default App;
