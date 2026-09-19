import {
  Link,
  useParams,
} from 'react-router-dom';

import {
  getListing,
} from '../api/client';

import { useApi } from '../api/useApi';

import {
  DetailFields,
} from './DetailFields';

import {
  StatusPill,
} from './StatusPill';

import {
  EmptyState,
  ErrorState,
  LoadingState,
} from './States';

export function ListingDetail(): JSX.Element {
  const {
    listingId = '',
  } = useParams();

  const {
    data,
    loading,
    error,
    refresh,
  } = useApi(
    () => getListing(listingId),
    [listingId],
  );

  if (loading && !data) {
    return (
      <LoadingState label="listing" />
    );
  }

  if (error) {
    return (
      <ErrorState
        error={error}
        onRetry={refresh}
      />
    );
  }

  if (!data) {
    return (
      <EmptyState
        title="Listing not found"
      />
    );
  }

  const listing =
    data.data;

  return (
    <>
      <div className="page-header">
        <div>
          <div className="eyebrow">
            Listing Review
          </div>

          <h1>
            {listing.title ??
              listing.listing_id}
          </h1>

          <p>
            {listing.description ??
              'Listing details returned by the API.'}
          </p>
        </div>

        <div className="page-header-action">
          <Link
            to="/ops"
            className="button button--secondary"
          >
            Back to operations
          </Link>
        </div>
      </div>

      <div className="detail-hero">
        <div>
          <span className="detail-hero-label">
            Listing ID
          </span>

          <strong>
            {listing.listing_id}
          </strong>
        </div>

        <div>
          <span className="detail-hero-label">
            Risk
          </span>

          <StatusPill
            value={
              listing.listing_risk
            }
          />
        </div>

        <div>
          <span className="detail-hero-label">
            Status
          </span>

          <StatusPill
            value={listing.status}
          />
        </div>

        {listing.seller_id && (
          <Link
            to={`/ops/sellers/${encodeURIComponent(
              listing.seller_id,
            )}`}
            className="button button--secondary"
          >
            View seller
          </Link>
        )}
      </div>

      <section className="panel">
        <div className="eyebrow">
          Listing data
        </div>

        <h2>
          Complete API response
        </h2>

        <DetailFields
          data={
            listing as Record<
              string,
              unknown
            >
          }
        />
      </section>
    </>
  );
}
