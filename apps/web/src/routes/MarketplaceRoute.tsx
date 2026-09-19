import {
  Link,
} from 'react-router-dom';

import { PageHeader } from '../components/PageHeader';
import { ListingAnalyze } from '../features/listing/ListingAnalyze';

export function MarketplaceRoute(): JSX.Element {
  return (
    <>
      <PageHeader
        eyebrow="Marketplace"
        title="Seller listing workspace"
        description="Submit listing information to ReturnShield ListingGuard and inspect the returned analysis."
        action={
          <Link
            to="/ops"
            className="button button--secondary"
          >
            Open Operations
          </Link>
        }
      />

      <ListingAnalyze />
    </>
  );
}

export default MarketplaceRoute;
