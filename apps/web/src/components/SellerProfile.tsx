import {
  Link,
  useParams,
} from 'react-router-dom';

import {
  getSeller,
} from '../api/client';

import { useApi } from '../api/useApi';

import { PageHeader } from './PageHeader';
import { DetailFields } from './DetailFields';

import {
  EmptyState,
  ErrorState,
  LoadingState,
} from './States';

export function SellerProfile(): JSX.Element {
  const {
    sellerId = '',
  } = useParams();

  const {
    data,
    loading,
    error,
    refresh,
  } = useApi(
    () => getSeller(sellerId),
    [sellerId],
  );

  if (loading && !data) {
    return (
      <LoadingState label="seller" />
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
        title="Seller not found"
      />
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Seller Profile"
        title={sellerId}
        description="Seller context and history returned by the ReturnShield API."
        action={
          <Link
            className="button button--secondary"
            to="/ops"
          >
            Back to operations
          </Link>
        }
      />

      <section className="panel">
        <DetailFields
          data={
            data.data as Record<
              string,
              unknown
            >
          }
        />
      </section>
    </>
  );
}
