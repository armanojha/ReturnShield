import { Link } from 'react-router-dom';

import { ListingGuardForm } from '../features/listing/ListingGuardForm';
import { Page } from '../components/Page';

const linkStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 'var(--space-2) var(--space-4)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  background: 'var(--surface)',
  color: 'var(--text)',
  textDecoration: 'none',
  fontWeight: 700,
};

export function MarketplaceRoute(): JSX.Element {
  return (
    <Page
      eyebrow="Integration"
      title="Seller and customer workflows"
      lede="Use the connected e-commerce platform to submit listings for ListingGuard and submit customer return requests to ReturnShield."
    >
      <section className="panel">
        <div>
          <p className="page__eyebrow">Seller</p>

          <h2 className="panel__title">
            ListingGuard
          </h2>

          <p className="panel__body">
            A seller creates a listing in the connected
            e-commerce platform. The platform sends the
            listing information to ReturnShield for
            analysis before publication.
          </p>

          <p className="panel__meta">
            Listing information is supplied by the
            connected platform. ReturnShield does not
            define a fixed set of sellers, products,
            categories, or catalogue values.
          </p>
        </div>
      </section>

      <ListingGuardForm />

      <section className="panel">
        <div>
          <p className="page__eyebrow">Customer</p>

          <h2 className="panel__title">
            Return request
          </h2>

          <p className="panel__body">
            Customers submit return requests through the
            connected e-commerce platform. ReturnShield
            evaluates the request in the background and
            returns a customer-safe status.
          </p>

          <div
            style={{
              display: 'flex',
              gap: 'var(--space-3)',
              flexWrap: 'wrap',
              marginTop: 'var(--space-4)',
            }}
          >
            <Link
              to="/marketplace/return"
              style={linkStyle}
            >
              Request a return
            </Link>

            <Link
              to="/marketplace/track"
              style={linkStyle}
            >
              Track a return
            </Link>
          </div>
        </div>
      </section>
    </Page>
  );
}

export default MarketplaceRoute;
