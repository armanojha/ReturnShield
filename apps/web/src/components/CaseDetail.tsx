import {
  useState,
} from 'react';

import {
  Link,
} from 'react-router-dom';

import {
  ApiError,
  getCase,
  submitReviewerDecision,
} from '../api/client';

import type {
  ReviewerDecision,
  ReturnCase,
  Signal,
} from '../api/types';

import { useApi } from '../api/useApi';

import { SignalBar } from './SignalBar';
import { StatusPill } from './StatusPill';
import {
  DetailFields,
} from './DetailFields';
import {
  ErrorState,
  LoadingState,
} from './States';

interface CaseDetailProps {
  caseId: string;
  onChanged?: () => void;
}

const SIGNAL_MAX: Record<
  string,
  number
> = {
  seller_history: 30,
  listing_quality: 25,
  customer_pattern: 20,
  current_return: 20,
  product_category: 15,
};

export function CaseDetail({
  caseId,
  onChanged,
}: CaseDetailProps): JSX.Element {
  const {
    data,
    loading,
    error,
    refresh,
  } = useApi(
    () => getCase(caseId),
    [caseId],
  );

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    actionError,
    setActionError,
  ] = useState<ApiError | null>(
    null,
  );

  const [
    confirmation,
    setConfirmation,
  ] = useState<string | null>(
    null,
  );

  if (loading && !data) {
    return (
      <LoadingState label="case" />
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
    return <LoadingState label="case" />;
  }

  const caseData =
    data.data;

  async function submitDecision(
    decision: ReviewerDecision,
  ) {
    setSubmitting(true);
    setActionError(null);
    setConfirmation(null);

    try {
      await submitReviewerDecision(
        caseId,
        decision,
      );

      setConfirmation(
        decision ===
          'APPROVE_RETURN'
          ? 'Return approved successfully.'
          : 'Return declined successfully.',
      );

      await refresh();

      onChanged?.();
    } catch (cause) {
      setActionError(
        cause instanceof ApiError
          ? cause
          : new ApiError(
              'network',
              'The reviewer decision could not be saved.',
            ),
      );
    } finally {
      setSubmitting(false);
    }
  }

  const signals =
    getSignals(caseData);

  const explanation =
    caseData.explanation ??
    caseData.ai_explanation;

  return (
    <section className="case-detail">
      <div className="case-hero">
        <div>
          <div className="eyebrow">
            Case Investigation
          </div>

          <div className="case-id">
            {caseData.case_id}
          </div>

          <div className="case-meta">
            {caseData.reason ??
              'Return investigation'}
          </div>
        </div>

        <div className="risk-score-card">
          <div className="risk-score-label">
            Risk score
          </div>

          <div className="risk-score">
            {caseData.risk_score ??
              '—'}
          </div>

          <StatusPill
            value={
              caseData.decision
            }
          />
        </div>
      </div>

      <div className="case-grid">
        <div className="case-main">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <div className="eyebrow">
                  Risk engine
                </div>

                <h2>
                  Contributing signals
                </h2>
              </div>
            </div>

            {signals.length === 0 ? (
              <p className="muted">
                No signal contributions
                were returned by the API.
              </p>
            ) : (
              <div className="signal-list">
                {signals.map(
                  (
                    signal,
                    index,
                  ) => (
                    <SignalBar
                      key={`${signal.signal}-${index}`}
                      label={
                        signal.signal
                      }
                      contribution={
                        signal.contribution
                      }
                      max={
                        SIGNAL_MAX[
                          signal.signal
                        ] ?? 100
                      }
                    />
                  ),
                )}
              </div>
            )}
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <div className="eyebrow">
                  Evidence
                </div>

                <h2>
                  Investigation evidence
                </h2>
              </div>
            </div>

            {caseData.evidence &&
            caseData.evidence.length >
              0 ? (
              <div className="evidence-list">
                {caseData.evidence.map(
                  (
                    evidence,
                    index,
                  ) => (
                    <div
                      className="evidence-card"
                      key={
                        evidence.evidence_id ??
                        index
                      }
                    >
                      <div className="evidence-number">
                        {index + 1}
                      </div>

                      <div>
                        <strong>
                          {evidence.field ??
                            evidence.source ??
                            'Evidence'}
                        </strong>

                        <p>
                          {evidence.quote ??
                            JSON.stringify(
                              evidence,
                            )}
                        </p>
                      </div>
                    </div>
                  ),
                )}
              </div>
            ) : (
              <p className="muted">
                No evidence was returned.
              </p>
            )}
          </section>

          {explanation && (
            <section className="panel">
              <div className="eyebrow">
                AI Investigator
              </div>

              <h2>
                Evidence-based explanation
              </h2>

              <div className="explanation">
                {typeof explanation ===
                'string'
                  ? explanation
                  : JSON.stringify(
                      explanation,
                      null,
                      2,
                    )}
              </div>
            </section>
          )}

          {caseData.timeline &&
            caseData.timeline.length >
              0 && (
              <section className="panel">
                <div className="eyebrow">
                  Workflow
                </div>

                <h2>
                  Evidence timeline
                </h2>

                <div className="timeline">
                  {caseData.timeline.map(
                    (
                      event,
                      index,
                    ) => (
                      <div
                        className="timeline-item"
                        key={index}
                      >
                        <div className="timeline-dot" />

                        <div>
                          <strong>
                            {event.event_type ??
                              'Event'}
                          </strong>

                          <p>
                            {event.description ??
                              ''}
                          </p>

                          {event.timestamp && (
                            <small>
                              {formatDate(
                                event.timestamp,
                              )}
                            </small>
                          )}
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </section>
            )}

          <section className="panel">
            <div className="eyebrow">
              Case context
            </div>

            <h2>
              Returned case fields
            </h2>

            <DetailFields
              data={
                caseData as Record<
                  string,
                  unknown
                >
              }
            />
          </section>
        </div>

        <aside className="case-sidebar">
          <section className="panel reviewer-panel">
            <div className="eyebrow">
              Reviewer action
            </div>

            <h2>
              Resolve case
            </h2>

            <p className="muted">
              The reviewer decision is
              persisted through the
              ReturnShield API.
            </p>

            {actionError && (
              <div className="inline-error">
                {actionError.message}
              </div>
            )}

            {confirmation && (
              <div className="inline-success">
                {confirmation}
              </div>
            )}

            <button
              type="button"
              className="button button--success button--large"
              disabled={submitting}
              onClick={() =>
                submitDecision(
                  'APPROVE_RETURN',
                )
              }
            >
              {submitting
                ? 'Saving…'
                : 'Approve return'}
            </button>

            <button
              type="button"
              className="button button--danger button--large"
              disabled={submitting}
              onClick={() =>
                submitDecision(
                  'DECLINE_RETURN',
                )
              }
            >
              {submitting
                ? 'Saving…'
                : 'Decline return'}
            </button>
          </section>

          {caseData.seller_id && (
            <section className="panel">
              <div className="eyebrow">
                Seller
              </div>

              <h2>
                {caseData.seller_id}
              </h2>

              <Link
                className="button button--secondary button--full"
                to={`/ops/sellers/${encodeURIComponent(
                  caseData.seller_id,
                )}`}
              >
                View seller profile
              </Link>
            </section>
          )}

          {caseData.listing_id && (
            <section className="panel">
              <div className="eyebrow">
                Listing
              </div>

              <h2>
                {caseData.listing_id}
              </h2>

              <Link
                className="button button--secondary button--full"
                to={`/ops/listings/${encodeURIComponent(
                  caseData.listing_id,
                )}`}
              >
                View listing
              </Link>
            </section>
          )}
        </aside>
      </div>
    </section>
  );
}

function getSignals(
  data: ReturnCase,
): Signal[] {
  if (
    Array.isArray(data.signals)
  ) {
    return data.signals;
  }

  if (
    Array.isArray(
      data.risk_contributions,
    )
  ) {
    return data.risk_contributions;
  }

  return [];
}

function formatDate(
  value: string,
): string {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return date.toLocaleString();
}
