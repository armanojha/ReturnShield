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
  ImageEvidence,
  Listing,
  ReturnCase,
} from '../../api/types';

import { Badge } from '../../components/Badge/Badge';
import {
  ScoreGauge,
} from '../../components/ScoreGauge/ScoreGauge';
import {
  SignalBar,
} from '../../components/SignalBar/SignalBar';
import {
  DecisionPanel,
} from '../../components/DecisionPanel/DecisionPanel';
import {
  ErrorState,
} from '../../components/ErrorState/ErrorState';

function formatDate(
  value: string | undefined,
): string {
  if (!value) {
    return 'Unavailable';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Unavailable';
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      dateStyle: 'medium',
      timeStyle: 'short',
    },
  ).format(date);
}

function formatLabel(
  value: string | null | undefined,
): string {
  if (!value) {
    return 'Unavailable';
  }

  return value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase(),
    );
}

function RiskScoreDisplay({
  score,
}: {
  score: number | null;
}): JSX.Element {
  if (score === null) {
    return (
      <div
        className="score-ring score-ring--lg"
        aria-label="Risk score unavailable"
        style={{
          background:
            'conic-gradient(#e8eeea 0 360deg)',
        }}
      >
        <div>
          <strong>—</strong>
          <span>score</span>
        </div>
      </div>
    );
  }

  return (
    <ScoreGauge
      score={score}
      size="lg"
    />
  );
}

function getListingStatusText(
  listing?: Listing,
): string {
  if (!listing) {
    return 'Listing details unavailable';
  }

  return listing.status === 'PASS'
    ? 'Listing passed ListingGuard'
    : 'Listing requires correction';
}

export function CaseDetail(): JSX.Element {
  const {
    caseId = '',
  } = useParams();

  const [value, setValue] =
    useState<ReturnCase | null>(null);

  const [listing, setListing] =
    useState<Listing | null>(null);

  const [images, setImages] =
    useState<ImageEvidence[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<ApiError | Error | string | null>(
      null,
    );

  const [imageError, setImageError] =
    useState<string | null>(null);

  const load = useCallback(
    async (): Promise<void> => {
      if (!caseId.trim()) {
        setError(
          'A case ID is required to view case details.',
        );
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      setImageError(null);

      try {
        const caseResponse =
          await apiClient.getCase(
            caseId,
          );

        const currentCase =
          caseResponse.data;

        setValue(currentCase);

        const [
          listingResult,
          imageResult,
        ] = await Promise.all([
          apiClient
            .getListing(
              currentCase.listing_id,
            )
            .catch(() => null),

          apiClient
            .getCaseImages(
              currentCase.case_id,
            )
            .catch(() => null),
        ]);

        setListing(
          listingResult?.data ?? null,
        );

        setImages(
          imageResult?.data.items ?? [],
        );
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause
            : 'Case could not be loaded.',
        );
      } finally {
        setLoading(false);
      }
    },
    [caseId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  async function openImage(
    image: ImageEvidence,
  ): Promise<void> {
    setImageError(null);

    try {
      const response =
        await apiClient.getImageDownload(
          image.image_id,
        );

      window.open(
        response.data.download_url,
        '_blank',
        'noopener,noreferrer',
      );
    } catch (cause) {
      setImageError(
        cause instanceof Error
          ? cause.message
          : 'The image could not be opened.',
      );
    }
  }

  if (loading) {
    return (
      <div className="page-loader">
        <span />
        Loading case intelligence…
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

  if (!value) {
    return (
      <div className="empty-panel">
        Case details are unavailable.
      </div>
    );
  }

  const explanation =
    value.explanation;

  const listingAnalysis =
    listing?.analysis;

  const evidenceCount =
    value.evidence.length +
    images.length;

  return (
    <div className="case-page">
      <div className="breadcrumbs">
        <Link to="/ops">
          Overview
        </Link>

        <span>/</span>

        <Link to="/ops#queue">
          Risk queue
        </Link>

        <span>/</span>

        <strong>
          {value.case_id}
        </strong>
      </div>

      <div className="case-hero">
        <div>
          <span className="eyebrow">
            Return investigation
          </span>

          <h1>
            {value.case_id}
          </h1>

          <div className="badge-row">
            <Badge
              kind={
                value.priority
              }
            />

            <Badge
              kind={
                value.review_status
              }
            />

            <Badge
              kind={
                value.decision
              }
            />
          </div>
        </div>

        <div className="case-meta">
          <div>
            <span>
              Order
            </span>

            <strong>
              {value.order_id}
            </strong>
          </div>

          <div>
            <span>
              Seller
            </span>

            <Link
              to={`/ops/sellers/${encodeURIComponent(
                value.seller_id,
              )}`}
            >
              {value.seller_id}
            </Link>
          </div>

          <div>
            <span>
              Customer
            </span>

            <strong>
              {value.customer_id}
            </strong>
          </div>

          <div>
            <span>
              Return reason
            </span>

            <strong>
              {formatLabel(
                value.reason,
              )}
            </strong>
          </div>

          <div>
            <span>
              Last updated
            </span>

            <strong>
              {formatDate(
                value.updated_at,
              )}
            </strong>
          </div>
        </div>
      </div>

      <div className="case-layout">
        <div className="case-primary">
          <section className="surface risk-summary">
            <div className="section-heading">
              <div>
                <span className="eyebrow">
                  Deterministic assessment
                </span>

                <h2>
                  Risk composition
                </h2>

                <p>
                  Risk signals returned by the
                  ReturnShield risk evaluation.
                </p>
              </div>

              <RiskScoreDisplay
                score={
                  value.risk_score
                }
              />
            </div>

            {value.contributions.length >
            0 ? (
              <div className="signals">
                {value.contributions.map(
                  (contribution) => (
                    <SignalBar
                      key={
                        contribution.risk_event_id
                      }
                      signal={
                        contribution.signal
                      }
                      contribution={
                        contribution.contribution
                      }
                      max={
                        contribution.max
                      }
                      reason={
                        contribution.reason
                      }
                    />
                  ),
                )}
              </div>
            ) : (
              <div className="empty-panel">
                No risk contribution data is
                available for this case.
              </div>
            )}

            <p className="raw-score">
              Raw contributions{' '}
              <strong>
                {value.raw_contribution_total ??
                  'Unavailable'}
              </strong>
              {' · '}
              final score{' '}
              <strong>
                {value.risk_score ??
                  'Unavailable'}
              </strong>
            </p>
          </section>

          <section className="surface">
            <div className="section-heading">
              <div>
                <span className="eyebrow">
                  Evidence grounded
                </span>

                <h2>
                  AI Investigator
                </h2>
              </div>

              <Badge
                kind={
                  value.explanation_status
                }
              />
            </div>

            {explanation ? (
              <div className="investigator">
                <p>
                  {explanation.summary}
                </p>

                {explanation.factors.length >
                0 ? (
                  <div className="factor-grid">
                    {explanation.factors.map(
                      (
                        factor,
                        index,
                      ) => (
                        <article
                          key={`${factor.signal}-${index}`}
                        >
                          <span>
                            {String(
                              index + 1,
                            ).padStart(
                              2,
                              '0',
                            )}
                          </span>

                          <div>
                            <strong>
                              {formatLabel(
                                factor.signal,
                              )}
                            </strong>

                            <p>
                              {
                                factor.explanation
                              }
                            </p>
                          </div>
                        </article>
                      ),
                    )}
                  </div>
                ) : (
                  <div className="empty-panel">
                    No investigator factors were
                    returned for this case.
                  </div>
                )}

                {explanation.recommended_action && (
                  <div className="recommendation">
                    <span>
                      Recommended next action
                    </span>

                    <strong>
                      {
                        explanation.recommended_action
                      }
                    </strong>
                  </div>
                )}
              </div>
            ) : (
              <div className="empty-panel">
                No validated investigator explanation
                is available for this case.
              </div>
            )}
          </section>

          <section className="surface">
            <div className="section-heading">
              <div>
                <span className="eyebrow">
                  Supporting context
                </span>

                <h2>
                  Evidence ledger
                </h2>
              </div>

              <span className="count-chip">
                {evidenceCount}{' '}
                {evidenceCount === 1
                  ? 'item'
                  : 'items'}
              </span>
            </div>

            {imageError && (
              <div
                className="inline-error"
                role="alert"
              >
                {imageError}
              </div>
            )}

            {evidenceCount > 0 ? (
              <div className="evidence-grid">
                {value.evidence.map(
                  (item) => (
                    <article
                      key={
                        item.evidence_id
                      }
                    >
                      <span className="evidence-kind">
                        {formatLabel(
                          item.kind,
                        )}
                      </span>

                      <p>
                        {item.text}
                      </p>

                      <small>
                        {item.source_id}
                        {' · '}
                        {formatDate(
                          item.observed_at,
                        )}
                      </small>
                    </article>
                  ),
                )}

                {images.map(
                  (image) => (
                    <article
                      className="image-evidence"
                      key={
                        image.image_id
                      }
                    >
                      <span className="evidence-kind">
                        IMAGE EVIDENCE
                      </span>

                      <p>
                        {image.analysis
                          ?.summary ??
                          `${image.content_type} · ${
                            image.width ??
                            'unknown'
                          } × ${
                            image.height ??
                            'unknown'
                          }`}
                      </p>

                      <small>
                        Status:{' '}
                        {
                          image.analysis_status
                        }
                      </small>

                      <button
                        type="button"
                        onClick={() =>
                          void openImage(
                            image,
                          )
                        }
                      >
                        Open secure image ↗
                      </button>
                    </article>
                  ),
                )}
              </div>
            ) : (
              <div className="empty-panel">
                No supporting evidence is available
                for this case.
              </div>
            )}
          </section>

          <section className="surface">
            <div className="section-heading">
              <div>
                <span className="eyebrow">
                  Return context
                </span>

                <h2>
                  Case information
                </h2>
              </div>
            </div>

            <div
              className="listing-facts"
              style={{
                gridTemplateColumns:
                  'repeat(2, minmax(0, 1fr))',
              }}
            >
              <span>
                Order
                <strong>
                  {value.order_id}
                </strong>
              </span>

              <span>
                Seller
                <strong>
                  {value.seller_id}
                </strong>
              </span>

              <span>
                Listing
                <strong>
                  {value.listing_id}
                </strong>
              </span>

              <span>
                Customer
                <strong>
                  {value.customer_id}
                </strong>
              </span>

              <span>
                Case status
                <strong>
                  {formatLabel(
                    value.status,
                  )}
                </strong>
              </span>

              <span>
                Review status
                <strong>
                  {formatLabel(
                    value.review_status,
                  )}
                </strong>
              </span>
            </div>
          </section>
        </div>

        <aside className="case-aside">
          <section className="surface sticky-card">
            <div className="section-heading">
              <div>
                <span className="eyebrow">
                  Human checkpoint
                </span>

                <h2>
                  Final disposition
                </h2>

                <p>
                  Reviewers can approve or decline a
                  return and record their rationale.
                </p>
              </div>
            </div>

            <DecisionPanel
              value={value}
              onDecision={setValue}
            />
          </section>

          <section className="surface listing-card">
            <span className="eyebrow">
              Listing context
            </span>

            {listing ? (
              <>
                <h3>
                  {listing.title}
                </h3>

                <p>
                  {listing.description}
                </p>

                <div className="listing-facts">
                  <span>
                    Category
                    <strong>
                      {listing.category}
                    </strong>
                  </span>

                  <span>
                    Guard status
                    <Badge
                      kind={
                        listing.status
                      }
                    />
                  </span>
                </div>

                <p
                  className="panel__meta"
                  style={{
                    marginTop:
                      'var(--space-3)',
                  }}
                >
                  {getListingStatusText(
                    listing,
                  )}
                </p>

                {listingAnalysis && (
                  <>
                    {(
                      listingAnalysis
                        .issues ??
                      []
                    ).length > 0 && (
                      <div
                        style={{
                          marginTop:
                            'var(--space-3)',
                        }}
                      >
                        <span className="evidence-kind">
                          LISTING ISSUES
                        </span>

                        <ul
                          style={{
                            marginTop:
                              'var(--space-2)',
                            paddingLeft:
                              'var(--space-4)',
                          }}
                        >
                          {(
                            listingAnalysis
                              .issues ??
                            []
                          ).map(
                            (
                              issue,
                            ) => (
                              <li
                                key={
                                  issue.issue_id
                                }
                              >
                                {
                                  issue.description
                                }
                              </li>
                            ),
                          )}
                        </ul>
                      </div>
                    )}

                    {(
                      listingAnalysis
                        .evidence ??
                      []
                    ).length > 0 && (
                      <div
                        style={{
                          marginTop:
                            'var(--space-3)',
                        }}
                      >
                        <span className="evidence-kind">
                          LISTING EVIDENCE
                        </span>

                        <div
                          style={{
                            display:
                              'grid',
                            gap:
                              'var(--space-2)',
                            marginTop:
                              'var(--space-2)',
                          }}
                        >
                          {(
                            listingAnalysis
                              .evidence ??
                            []
                          ).map(
                            (
                              evidence,
                            ) => (
                              <div
                                key={
                                  evidence.evidence_id
                                }
                              >
                                <strong>
                                  {formatLabel(
                                    evidence.field,
                                  )}
                                </strong>

                                <p
                                  style={{
                                    margin:
                                      '3px 0 0',
                                  }}
                                >
                                  “
                                  {
                                    evidence.quote
                                  }
                                  ”
                                </p>
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    )}

                    {listingAnalysis.recommended_action && (
                      <div
                        className="recommendation"
                        style={{
                          marginTop:
                            'var(--space-3)',
                        }}
                      >
                        <span>
                          Recommended action
                        </span>

                        <strong>
                          {
                            listingAnalysis.recommended_action
                          }
                        </strong>
                      </div>
                    )}
                  </>
                )}
              </>
            ) : (
              <>
                <h3>
                  {value.listing_id}
                </h3>

                <p>
                  Listing details are not available
                  for this case.
                </p>
              </>
            )}
          </section>

          <section className="surface timeline-card">
            <span className="eyebrow">
              Audit trail
            </span>

            <h3>
              Case timeline
            </h3>

            {value.timeline.length > 0 ? (
              <ol>
                {value.timeline.map(
                  (entry) => (
                    <li
                      key={
                        entry.event_id
                      }
                    >
                      <i />

                      <div>
                        <strong>
                          {formatLabel(
                            entry.type,
                          )}
                        </strong>

                        <p>
                          {entry.message}
                        </p>

                        <small>
                          {formatDate(
                            entry.timestamp,
                          )}
                        </small>
                      </div>
                    </li>
                  ),
                )}
              </ol>
            ) : (
              <div className="empty-panel">
                No timeline events are available.
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

export default CaseDetail;
