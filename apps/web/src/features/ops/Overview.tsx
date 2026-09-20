import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import type { CSSProperties } from 'react';

import { ApiError, apiClient } from '../../api/client';
import type {
  DashboardResponse,
} from '../../api/types';

import { MetricCard } from '../../components/MetricCard/MetricCard';
import { ErrorState } from '../../components/ErrorState/ErrorState';

type DashboardMetrics = DashboardResponse['data'];

function formatAsOf(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Time unavailable';
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function buildConicGradient(
  approved: number,
  normalReview: number,
  highReview: number,
  missingContext: number,
): string {
  const total =
    approved +
    normalReview +
    highReview +
    missingContext;

  if (total === 0) {
    return 'conic-gradient(#e8eeeb 0 360deg)';
  }

  const approvedEnd =
    (approved / total) * 360;

  const normalEnd =
    approvedEnd +
    (normalReview / total) * 360;

  const highEnd =
    normalEnd +
    (highReview / total) * 360;

  return [
    `#24b978 0 ${approvedEnd}deg`,
    `#e4a03f ${approvedEnd}deg ${normalEnd}deg`,
    `#d88c25 ${normalEnd}deg ${highEnd}deg`,
    `#eb6860 ${highEnd}deg 360deg`,
  ].join(', ');
}

export function Overview(): JSX.Element {
  const [metrics, setMetrics] =
    useState<DashboardMetrics | null>(null);

  const [healthOk, setHealthOk] =
    useState<boolean | null>(null);

  const [error, setError] =
    useState<ApiError | Error | string | null>(
      null,
    );

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const load = useCallback(
    async (isRefresh = false): Promise<void> => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      const [dashboardResult, healthResult] =
        await Promise.allSettled([
          apiClient.getDashboard(),
          apiClient.getHealth(),
        ]);

      if (
        dashboardResult.status ===
        'fulfilled'
      ) {
        setMetrics(
          dashboardResult.value.data,
        );
      } else {
        const dashboardError =
          dashboardResult.reason;

        setError(
          dashboardError instanceof Error
            ? dashboardError
            : 'Dashboard data could not be loaded.',
        );
      }

      if (
        healthResult.status ===
        'fulfilled'
      ) {
        setHealthOk(
          healthResult.value.data.status ===
            'ok',
        );
      } else {
        setHealthOk(false);
      }

      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const distribution = useMemo(() => {
    if (!metrics) {
      return {
        approved: 0,
        normalReview: 0,
        highReview: 0,
        missingContext: 0,
        total: 0,
      };
    }

    const approved =
      metrics.auto_approved_returns;

    const normalReview =
      metrics.normal_review_cases;

    const highReview =
      metrics.high_review_cases;

    const missingContext =
      metrics.missing_context_cases;

    return {
      approved,
      normalReview,
      highReview,
      missingContext,
      total:
        approved +
        normalReview +
        highReview +
        missingContext,
    };
  }, [metrics]);

  if (
    error &&
    !metrics
  ) {
    return (
      <ErrorState
        error={error}
        onRetry={() => void load()}
      />
    );
  }

  const donutStyle: CSSProperties & {
    '--distribution': string;
  } = {
    '--distribution':
      buildConicGradient(
        distribution.approved,
        distribution.normalReview,
        distribution.highReview,
        distribution.missingContext,
      ),
    background:
      'var(--distribution)',
  };

  return (
    <>
      <section className="metric-grid">
        <MetricCard
          label="Open reviews"
          value={
            loading
              ? '—'
              : metrics?.open_review_cases ?? 0
          }
          kind="danger"
          detail="Cases currently awaiting analyst action"
        />

        <MetricCard
          label="Auto-approved"
          value={
            loading
              ? '—'
              : metrics?.auto_approved_returns ?? 0
          }
          kind="ok"
          detail="Returns currently routed to automatic approval"
        />

        <MetricCard
          label="High priority"
          value={
            loading
              ? '—'
              : metrics?.high_review_cases ?? 0
          }
          kind="warn"
          detail="Cases currently routed to high-priority review"
        />

        <MetricCard
          label="Flagged listings"
          value={
            loading
              ? '—'
              : metrics?.flagged_listings ?? 0
          }
          detail="Listings currently requiring correction"
        />
      </section>

      <section className="insight-grid">
        <article className="surface chart-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">
                Current routing
              </span>

              <h2>
                Return decision distribution
              </h2>

              {metrics && (
                <p>
                  Based on the dashboard data returned
                  by ReturnShield.
                </p>
              )}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
              }}
            >
              {metrics && (
                <span className="live-chip">
                  Updated {formatAsOf(metrics.as_of)}
                </span>
              )}

              <button
                type="button"
                className="button-secondary"
                onClick={() => void load(true)}
                disabled={
                  loading ||
                  refreshing
                }
              >
                {refreshing
                  ? 'Refreshing…'
                  : 'Refresh'}
              </button>
            </div>
          </div>

          <div className="distribution">
            <div
              className="donut"
              style={donutStyle}
              aria-label={`Current return routing total: ${distribution.total}`}
            >
              <div>
                <strong>
                  {loading
                    ? '—'
                    : distribution.total}
                </strong>

                <span>
                  current cases
                </span>
              </div>
            </div>

            <div className="legend">
              <div>
                <i className="green" />

                <span>
                  Auto-approved
                </span>

                <strong>
                  {loading
                    ? '—'
                    : distribution.approved}
                </strong>
              </div>

              <div>
                <i className="amber" />

                <span>
                  Normal review
                </span>

                <strong>
                  {loading
                    ? '—'
                    : distribution.normalReview}
                </strong>
              </div>

              <div>
                <i className="amber" />

                <span>
                  High review
                </span>

                <strong>
                  {loading
                    ? '—'
                    : distribution.highReview}
                </strong>
              </div>

              <div>
                <i className="red" />

                <span>
                  Missing context
                </span>

                <strong>
                  {loading
                    ? '—'
                    : distribution.missingContext}
                </strong>
              </div>
            </div>
          </div>
        </article>

        <article className="surface system-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">
                System status
              </span>

              <h2>
                ReturnShield service
              </h2>

              <p>
                Status comes from the configured
                health endpoint.
              </p>
            </div>
          </div>

          <div className="pipeline">
            <div>
              <span>01</span>

              <p>
                <strong>
                  API service
                </strong>

                <small>
                  ReturnShield health check
                </small>
              </p>

              <b>
                {healthOk === null
                  ? 'Checking'
                  : healthOk
                    ? 'Operational'
                    : 'Unavailable'}
              </b>
            </div>

            <div>
              <span>02</span>

              <p>
                <strong>
                  Operations data
                </strong>

                <small>
                  Dashboard summary
                </small>
              </p>

              <b>
                {metrics
                  ? 'Available'
                  : loading
                    ? 'Loading'
                    : 'Unavailable'}
              </b>
            </div>

            <div>
              <span>03</span>

              <p>
                <strong>
                  Last update
                </strong>

                <small>
                  Timestamp returned by the service
                </small>
              </p>

              <b>
                {metrics
                  ? formatAsOf(metrics.as_of)
                  : '—'}
              </b>
            </div>
          </div>
        </article>
      </section>
    </>
  );
}
