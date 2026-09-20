import { Link } from 'react-router-dom';
import { Page } from '../components/Page';
import { ListingGuardForm } from '../features/listing/ListingGuardForm';

/**
 * `/marketplace` — the mock seller-facing surface.
 */
export function MarketplaceRoute(): JSX.Element {
  return (
    <Page
      eyebrow="Marketplace"
      title="Seller listing workspace"
      lede="The demonstration storefront that submits listings to ListingGuard and raises returns against synthetic orders."
    >
      <div
        style={{
          display: 'flex',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-6)',
          flexWrap: 'wrap',
        }}
      >
        <Link
          to="/marketplace/return"
          style={{
            padding: 'var(--space-2) var(--space-4)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            background: 'var(--surface)',
            color: 'var(--text)',
            textDecoration: 'none',
          }}
        >
          Request Return (Customer)
        </Link>
        <Link
          to="/marketplace/track"
          style={{
            padding: 'var(--space-2) var(--space-4)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            background: 'var(--surface)',
            color: 'var(--text)',
            textDecoration: 'none',
          }}
        >
          Track Return
        </Link>
      </div>
      <ListingGuardForm />
    </Page>
  );
}

export default MarketplaceRoute;
