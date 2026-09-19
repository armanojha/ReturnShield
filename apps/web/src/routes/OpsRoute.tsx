import {
  Link,
  useNavigate,
} from 'react-router-dom';

import {
  getCases,
  getDashboardSummary,
} from '../api/client';

import type {
  CaseSummary,
} from '../api/types';

import { useApi } from '../api/useApi';

import { PageHeader } from '../components/PageHeader';
import { MetricCard } from '../components/MetricCard';
import { StatusPill } from '../components/StatusPill';

import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../components/States';

export function OpsRoute(): JSX.Element {
  const navigate =
    useNavigate();

  const summary =
    useApi(
      getDashboardSummary,
      [],
    );

  const cases =
    useApi(
      getCases,
      [],
    );

  return (
    <>
      <PageHeader
        eyebrow="Trust Operations"
        title="Trust Operations Center"
        description="Review risk signals, evidence, deterministic decisions and reviewer actions from one operational surface."
        action={
          <Link
            to="/marketplace"
            className="button button--secondary"
          >
            Analyze listing
          </Link>
        }
      />

      <section className="section-block">
        <div className="section-heading">
          <div>
            <div className="eyebrow">
              Overview
            </div>

            <h2>
              Operations snapshot
            </h2>
          </div>

          <button
            type="button"
            className="button button--ghost"
            onClick={() => {
              summary.refresh();
              cases.refresh();
            }}
          >
            Refresh
          </button>
        </div>

        {summary.loading &&
        !summary.data ? (
          <LoadingState label="dashboard summary" />
        ) : summary.error ? (
          <ErrorState
            error={summary.error}
            onRetry={summary.refresh}
          />
        ) : summary.data ? (
          <SummaryGrid
            data={
              summary.data.data
            }
          />
        ) : (
          <EmptyState
            title="No dashboard summary"
          />
        )}
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <div className="eyebrow">
              Risk Queue
            </div>

            <h2>
              Cases requiring attention
            </h2>
          </div>

          <span className="queue-count">
            {cases.data?.data.length ??
              0}{' '}
            cases
          </span>
        </div>

        {cases.loading &&
        !cases.data ? (
          <LoadingState label="cases" />
        ) : cases.error ? (
          <ErrorState
            error={cases.error}
            onRetry={cases.refresh}
          />
        ) : !cases.data ||
          cases.data.data.length ===
            0 ? (
          <EmptyState
            title="No cases returned"
            description="The API currently has no cases available for review."
          />
        ) : (
          <CaseTable
            cases={
              cases.data.data
            }
            onOpen={(caseId) =>
              navigate(
                `/ops/cases/${encodeURIComponent(
                  caseId,
                )}`,
              )
            }
          />
        )}
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <div className="eyebrow">
              Listing Review
            </div>

            <h2>
              Inspect a listing
            </h2>
          </div>
        </div>

        <div className="lookup-card">
          <p>
            The current frozen API exposes
            listing lookup by ID. A
            collection endpoint can be
            added in the backend phase
            when the contract is extended.
          </p>

          <Link
            className="button button--secondary"
            to="/marketplace"
          >
            Analyze or inspect listing
          </Link>
        </div>
      </section>
    </>
  );
}

function SummaryGrid({
  data,
}: {
  data: Record<
    string,
    unknown
  >;
}): JSX.Element {
  const entries =
    Object.entries(data);

  if (entries.length === 0) {
    return (
      <EmptyState
        title="Dashboard returned no metrics"
      />
    );
  }

  return (
    <div className="metrics-grid">
      {entries.map(
        ([key, value]) => (
          <MetricCard
            key={key}
            label={key.replace(
              /_/g,
              ' ',
            )}
            value={value}
          />
        ),
      )}
    </div>
  );
}

function CaseTable({
  cases,
  onOpen,
}: {
  cases: CaseSummary[];
  onOpen: (
    caseId: string,
  ) => void;
}): JSX.Element {
  return (
    <div className="table-card">
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Case</th>
              <th>Risk</th>
              <th>Seller</th>
              <th>Listing</th>
              <th>Decision</th>
              <th>Reason</th>
              <th />
            </tr>
          </thead>

          <tbody>
            {cases.map((item) => (
              <tr
                key={item.case_id}
              >
                <td>
                  <button
                    type="button"
                    className="table-link"
                    onClick={() =>
                      onOpen(
                        item.case_id,
                      )
                    }
                  >
                    {item.case_id}
                  </button>
                </td>

                <td>
                  <span className="risk-number">
                    {item.risk_score ??
                      '—'}
                  </span>
                </td>

                <td>
                  {item.seller_id ??
                    '—'}
                </td>

                <td>
                  {item.listing_id ??
                    '—'}
                </td>

                <td>
                  <StatusPill
                    value={
                      item.decision
                    }
                  />
                </td>

                <td className="reason-cell">
                  {item.reason ??
                    '—'}
                </td>

                <td>
                  <button
                    type="button"
                    className="button button--small button--secondary"
                    onClick={() =>
                      onOpen(
                        item.case_id,
                      )
                    }
                  >
                    Investigate
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default OpsRoute;
