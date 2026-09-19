import { Page } from '../components/Page';
import { ListingGuardForm } from '../features/listing/ListingGuardForm';

/**
 * `/marketplace` — the mock seller-facing surface.
 *
 * Phase 01 delivers the shell and a live health check only. Listing submission
 * and ListingGuard results belong to Phase 03.
 */
export function MarketplaceRoute(): JSX.Element {
  return (
    <Page
      eyebrow="Marketplace"
      title="Seller listing workspace"
      lede="The demonstration storefront that submits listings to ListingGuard and raises returns against synthetic orders."
    >
      <ListingGuardForm />
    </Page>
  );
}

export default MarketplaceRoute;
