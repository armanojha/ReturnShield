import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  Link,
  useParams,
} from 'react-router-dom';

import {
  apiClient,
  ApiError,
} from '../../api/client';

import type {
  Seller,
} from '../../api/types';

import {
  MetricCard,
} from '../../components/MetricCard/MetricCard';

import {
  ErrorState,
} from '../../components/ErrorState/ErrorState';

function formatPercentage(
  value: number,
): string {
  if (!Number.isFinite(value)) {
    return '—';
  }

  return `${(
    value * 100
  ).toFixed(1)}%`;
}

function formatMetric(
  value: number,
): string | number {
  return Number.isFinite(value)
    ? value
    : '—';
}

export function SellerProfile(): JSX.Element {
  const {
    sellerId = '',
  } = useParams();

  const [seller, setSeller] =
    useState<Seller | null>(null);

  const [error, setError] =
    useState<ApiError | Error | string | null>(
      null,
    );

  const [loading, setLoading] =
    useState(true);

  const load = useCallback(
    async (): Promise<void> => {
      const id =
        sellerId.trim();

      if (!id) {
        setError(
          'A seller ID is required to view this page.',
        );
        setSeller(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response =
          await apiClient.getSeller(id);

        setSeller(
          response.data,
        );
      } catch (cause) {
        if (
          cause instanceof ApiError
        ) {
          setError(cause);
        } else if (
          cause instanceof Error
        ) {
          setError(cause);
        } else {
          setError(
            'Seller information could not be loaded.',
          );
        }
      } finally {
        setLoading(false);
      }
    },
    [sellerId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div
        className="page-loader"
        aria-live="polite"
      >
        <span />
        Loading seller profile…
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        error={error}
        onRetry={() => void load()}
      />
    );
  }

  if (!seller) {
    return (
      <div className="empty-panel">
        Seller information is unavailable.
      </div>
    );
  }

  const hasCases =
    seller.cases.length > 0;

  return (
    <div className="dashboard">
      <div className="breadcrumbs">
        <Link to="/ops">
          Overview
        </Link>

        <span>/</span>

        <strong>
          {seller.seller_id}
        </strong>
      </div>

      <div className="dashboard-header">
        <div>
          <span className="eyebrow">
            Seller intelligence
          </span>

          <h1>
            {seller.seller_id}
          </h1>

          <p>
            Seller-level information returned by
            the connected ReturnShield service.
          </p>
        </div>

        <button
          type="button"
          className="button-secondary"
          onClick={() => void load()}
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      <section className="metric-grid">
        <MetricCard
          label="Trust score"
          value={formatMetric(
            seller.trust_score,
          )}
          detail="Score returned by ReturnShield"
        />

        <MetricCard
          label="Return rate"
          value={formatPercentage(
            seller.return_rate,
          )}
          detail="Return rate returned by the service"
        />

        <MetricCard
          label="Disputes"
          value={formatMetric(
            seller.dispute_count,
          )}
          detail="Recorded disputes linked to this seller"
        />

        <MetricCard
          label="Listing flags"
          value={formatMetric(
            seller.listing_flags,
          )}
          detail="Listings currently flagged by the service"
        />
      </section>

      <section className="surface seller-cases">
        <div className="section-heading">
          <div>
            <span className="eyebrow">
              Linked investigations
            </span>

            <h2>
              Case history
            </h2>

            <p>
              Return cases currently associated
              with this seller.
            </p>
          </div>

          <span className="count-chip">
            {seller.cases.length}{' '}
            {seller.cases.length === 1
              ? 'case'
              : 'cases'}
          </span>
        </div>

        {hasCases ? (
          <div
            style={{
              display: 'grid',
              gap: 'var(--space-2)',
            }}
          >
            {seller.cases.map(
              (caseId) => (
                <Link
                  key={caseId}
                  to={`/ops/cases/${encodeURIComponent(
                    caseId,
                  )}`}
                  style={{
                    display: 'flex',
                    justifyContent:
                      'space-between',
                    alignItems:
                      'center',
                    gap: 'var(--space-3)',
                    padding:
                      'var(--space-3)',
                    border:
                      '1px solid var(--border)',
                    borderRadius:
                      'var(--radius)',
                    textDecoration:
                      'none',
                  }}
                >
                  <span>
                    <strong>
                      {caseId}
                    </strong>
                  </span>

                  <span>
                    Open investigation →
                  </span>
                </Link>
              ),
            )}
          </div>
        ) : (
          <div className="empty-panel">
            No return cases are currently linked
            to this seller.
          </div>
        )}
      </section>
    </div>
  );
}

export default SellerProfile;
