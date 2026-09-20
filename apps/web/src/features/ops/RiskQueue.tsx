import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  useNavigate,
} from 'react-router-dom';

import {
  ApiError,
  apiClient,
} from '../../api/client';

import type {
  CaseDecision,
  CaseQuery,
  CaseStatus,
  Priority,
  ReturnCase,
  ReviewStatus,
} from '../../api/types';

import {
  Badge,
} from '../../components/Badge/Badge';

import {
  DataTable,
} from '../../components/DataTable/DataTable';

interface QueueFilters {
  search: string;
  status: string;
  priority: string;
  decision: string;
  review_status: string;
  seller_id: string;
}

const INITIAL_FILTERS: QueueFilters = {
  search: '',
  status: '',
  priority: '',
  decision: '',
  review_status: '',
  seller_id: '',
};

const PAGE_SIZE = 25;

function normaliseSearchValue(
  value: unknown,
): string {
  return String(value ?? '').toLowerCase();
}

function matchesSearch(
  item: ReturnCase,
  search: string,
): boolean {
  const needle = search.trim().toLowerCase();

  if (!needle) {
    return true;
  }

  return [
    item.case_id,
    item.order_id,
    item.seller_id,
    item.listing_id,
    item.customer_id,
    item.reason,
  ].some((value) =>
    normaliseSearchValue(value).includes(
      needle,
    ),
  );
}

function formatDate(
  value: string,
): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      dateStyle: 'medium',
      timeStyle: 'short',
    },
  ).format(date);
}

function getRiskClass(
  riskScore: number | null,
): string {
  if (riskScore === null) {
    return 'risk-number';
  }

  if (riskScore >= 60) {
    return 'risk-number risk-high';
  }

  if (riskScore >= 30) {
    return 'risk-number risk-medium';
  }

  return 'risk-number risk-low';
}

function formatReason(
  reason: string,
): string {
  return reason
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase(),
    );
}

export function RiskQueue(): JSX.Element {
  const navigate = useNavigate();

  const [filters, setFilters] =
    useState<QueueFilters>(
      INITIAL_FILTERS,
    );

  const [items, setItems] =
    useState<ReturnCase[]>([]);

  const [nextCursor, setNextCursor] =
    useState<string | null>(null);

  const [cursorHistory, setCursorHistory] =
    useState<string[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState<ApiError | string | null>(
      null,
    );

  const [page, setPage] =
    useState(1);

  const currentCursor =
    cursorHistory.length > 0
      ? cursorHistory[
          cursorHistory.length - 1
        ]
      : undefined;

  const buildQuery = useCallback(
    (
      cursor?: string,
    ): CaseQuery => {
      const query: CaseQuery = {
        limit: PAGE_SIZE,
      };

      if (cursor) {
        query.cursor = cursor;
      }

      if (filters.status) {
        query.status = filters.status as CaseStatus;
      }

      if (filters.priority) {
        query.priority = filters.priority as Priority;
      }

      if (filters.decision) {
        query.decision = filters.decision as CaseDecision;
      }

      if (filters.review_status) {
        query.review_status = filters.review_status as Exclude<
          ReviewStatus,
          'NOT_APPLICABLE'
        >;
      }

      if (filters.seller_id.trim()) {
        query.seller_id = filters.seller_id.trim();
      }

      return query;
    },
    [filters],
  );

  const load = useCallback(
    async (
      options: {
        cursor?: string;
        isRefresh?: boolean;
      } = {},
    ): Promise<void> => {
      if (options.isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      try {
        const response =
          await apiClient.getCases(
            buildQuery(
              options.cursor,
            ),
          );

        setItems(
          response.data.items,
        );

        setNextCursor(
          response.data.next_cursor,
        );
      } catch (cause) {
        if (
          cause instanceof ApiError
        ) {
          setError(cause);
        } else if (
          cause instanceof Error
        ) {
          setError(cause.message);
        } else {
          setError(
            'The risk queue could not be loaded.',
          );
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [buildQuery],
  );

  useEffect(() => {
    setPage(1);
    setCursorHistory([]);

    void load();
  }, [
    filters.status,
    filters.priority,
    filters.decision,
    filters.review_status,
    filters.seller_id,
  ]);

  const visibleItems =
    useMemo(
      () =>
        items.filter((item) =>
          matchesSearch(
            item,
            filters.search,
          ),
        ),
      [items, filters.search],
    );

  function updateFilter(
    field: keyof QueueFilters,
    value: string,
  ): void {
    setFilters((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function resetFilters(): void {
    setFilters(
      INITIAL_FILTERS,
    );

    setPage(1);
    setCursorHistory([]);
  }

  async function nextPage(): Promise<void> {
    if (!nextCursor) {
      return;
    }

    const newHistory = [
      ...cursorHistory,
      nextCursor,
    ];

    setCursorHistory(newHistory);
    setPage((current) =>
      current + 1,
    );

    await load({
      cursor: nextCursor,
    });
  }

  async function previousPage(): Promise<void> {
    if (page <= 1) {
      return;
    }

    const newHistory =
      cursorHistory.slice(
        0,
        -1,
      );

    const previousCursor =
      newHistory.length > 0
        ? newHistory[
            newHistory.length - 1
          ]
        : undefined;

    setCursorHistory(
      newHistory,
    );

    setPage((current) =>
      Math.max(
        1,
        current - 1,
      ),
    );

    await load(
      previousCursor
        ? { cursor: previousCursor }
        : {},
    );
  }

  return (
    <section
      id="queue"
      className="surface queue-card"
      aria-labelledby="risk-queue-title"
    >
      <div className="section-heading queue-heading">
        <div>
          <span className="eyebrow">
            Analyst workspace
          </span>

          <h2 id="risk-queue-title">
            Risk review queue
          </h2>

          <p>
            Cases returned by the ReturnShield
            service that match the selected
            review filters.
          </p>
        </div>

        <button
          type="button"
          className="button-secondary"
          onClick={() =>
            void load(
              currentCursor
                ? {
                    cursor:
                      currentCursor,
                    isRefresh: true,
                  }
                : { isRefresh: true },
            )
          }
          disabled={
            loading ||
            refreshing
          }
        >
          {refreshing
            ? 'Refreshing…'
            : '↻ Refresh'}
        </button>
      </div>

      <div className="filters">
        <label className="filter-search">
          <span aria-hidden="true">
            ⌕
          </span>

          <input
            type="search"
            value={filters.search}
            onChange={(event) =>
              updateFilter(
                'search',
                event.target.value,
              )
            }
            placeholder="Search cases, orders, sellers or listings"
            aria-label="Search loaded risk queue cases"
          />
        </label>

        <select
          value={filters.status}
          onChange={(event) =>
            updateFilter(
              'status',
              event.target.value,
            )
          }
          aria-label="Filter by case status"
        >
          <option value="">
            All statuses
          </option>

          <option value="PROCESSING">
            Processing
          </option>

          <option value="DECIDED">
            Decided
          </option>

          <option value="ERROR_MISSING_CONTEXT">
            Missing context
          </option>

          <option value="FAILED">
            Failed
          </option>
        </select>

        <select
          value={filters.priority}
          onChange={(event) =>
            updateFilter(
              'priority',
              event.target.value,
            )
          }
          aria-label="Filter by priority"
        >
          <option value="">
            All priorities
          </option>

          <option value="HIGH">
            High
          </option>

          <option value="NORMAL">
            Normal
          </option>

          <option value="NONE">
            None
          </option>
        </select>

        <select
          value={filters.decision}
          onChange={(event) =>
            updateFilter(
              'decision',
              event.target.value,
            )
          }
          aria-label="Filter by decision"
        >
          <option value="">
            All decisions
          </option>

          <option value="AUTO_APPROVE">
            Auto-approved
          </option>

          <option value="NEEDS_REVIEW">
            Needs review
          </option>
        </select>

        <select
          value={filters.review_status}
          onChange={(event) =>
            updateFilter(
              'review_status',
              event.target.value,
            )
          }
          aria-label="Filter by review status"
        >
          <option value="">
            All review states
          </option>

          <option value="OPEN">
            Open
          </option>

          <option value="RESOLVED">
            Resolved
          </option>
        </select>

        <input
          type="search"
          value={filters.seller_id}
          onChange={(event) =>
            updateFilter(
              'seller_id',
              event.target.value,
            )
          }
          placeholder="Seller ID"
          aria-label="Filter by seller ID"
        />

        <button
          type="button"
          className="button-secondary"
          onClick={resetFilters}
        >
          Reset
        </button>

        <span className="result-count">
          {loading
            ? 'Loading…'
            : `${visibleItems.length} shown`}
        </span>
      </div>

      {error ? (
        <div
          className="inline-error"
          role="alert"
        >
          {error instanceof ApiError
            ? error.message
            : error}

          <button
            type="button"
            onClick={() =>
              void load(
                currentCursor
                  ? {
                      cursor:
                        currentCursor,
                    }
                  : {},
              )
            }
          >
            Retry
          </button>
        </div>
      ) : loading ? (
        <div
          className="skeleton-table"
          aria-label="Loading risk queue"
        />
      ) : (
        <>
          <DataTable<
            ReturnCase &
              Record<string, unknown>
          >
            rows={
              visibleItems as Array<
                ReturnCase &
                  Record<string, unknown>
              >
            }
            emptyMessage={
              filters.search ||
              filters.status ||
              filters.priority ||
              filters.decision ||
              filters.review_status ||
              filters.seller_id
                ? 'No cases match the selected filters.'
                : 'No cases require review.'
            }
            onRowClick={(row) =>
              navigate(
                `/ops/cases/${encodeURIComponent(
                  row.case_id,
                )}`,
              )
            }
            columns={[
              {
                key: 'case_id',
                header: 'Case',
                render: (row) => (
                  <div className="primary-cell">
                    <strong>
                      {row.case_id}
                    </strong>

                    <span>
                      {formatDate(
                        row.created_at,
                      )}
                    </span>
                  </div>
                ),
              },

              {
                key: 'risk_score',
                header: 'Risk',
                render: (row) => (
                  <span
                    className={getRiskClass(
                      row.risk_score,
                    )}
                  >
                    {row.risk_score ??
                      '—'}
                  </span>
                ),
              },

              {
                key: 'priority',
                header: 'Priority',
                render: (row) => (
                  <Badge
                    kind={row.priority}
                  />
                ),
              },

              {
                key: 'seller_id',
                header: 'Seller',
                render: (row) => (
                  <div className="primary-cell">
                    <strong>
                      {row.seller_id}
                    </strong>

                    <span>
                      {row.listing_id}
                    </span>
                  </div>
                ),
              },

              {
                key: 'reason',
                header: 'Return reason',
                render: (row) => (
                  <span>
                    {formatReason(
                      row.reason,
                    )}
                  </span>
                ),
              },

              {
                key: 'decision',
                header: 'Decision',
                render: (row) => (
                  <Badge
                    kind={
                      row.decision
                    }
                  />
                ),
              },

              {
                key: 'review_status',
                header: 'Review',
                render: (row) => (
                  <Badge
                    kind={
                      row.review_status
                    }
                  />
                ),
              },

              {
                key: 'updated_at',
                header: 'Updated',
                render: (row) => (
                  <span>
                    {formatDate(
                      row.updated_at,
                    )}
                  </span>
                ),
              },

              {
                key: 'action',
                header: '',
                render: () => (
                  <span className="row-arrow">
                    →
                  </span>
                ),
              },
            ]}
          />

          <div
            style={{
              display: 'flex',
              justifyContent:
                'space-between',
              alignItems: 'center',
              gap: 'var(--space-3)',
              marginTop:
                'var(--space-3)',
            }}
          >
            <span className="panel__meta">
              Page {page}
            </span>

            <div
              style={{
                display: 'flex',
                gap: 'var(--space-2)',
              }}
            >
              <button
                type="button"
                className="button-secondary"
                onClick={() =>
                  void previousPage()
                }
                disabled={
                  page === 1 ||
                  loading
                }
              >
                Previous
              </button>

              <button
                type="button"
                className="button-secondary"
                onClick={() =>
                  void nextPage()
                }
                disabled={
                  !nextCursor ||
                  loading
                }
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

export default RiskQueue;
