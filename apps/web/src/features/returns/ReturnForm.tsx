import { useState } from 'react';
import type { FormEvent, FC } from 'react';

import { apiClient, ApiError } from '../../api/client';
import { ErrorState } from '../../components/ErrorState/ErrorState';
import type {
  ReturnReason,
  ReturnCase,
} from '../../api/types';

const RETURN_REASONS: ReadonlyArray<{
  value: ReturnReason;
  label: string;
}> = [
  {
    value: 'NOT_AS_DESCRIBED',
    label: 'Not as described',
  },
  {
    value: 'DAMAGED',
    label: 'Damaged',
  },
  {
    value: 'WRONG_ITEM',
    label: 'Wrong item',
  },
  {
    value: 'NOT_RECEIVED',
    label: 'Not received',
  },
  {
    value: 'CHANGED_MIND',
    label: 'Changed mind',
  },
];

type CustomerStatus =
  | 'PROCESSING'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'DECLINED';

interface FormState {
  order_id: string;
  reason: ReturnReason;
  evidence_text: string;
}

interface CustomerResult {
  case_id: string;
  status: CustomerStatus;
  replayed: boolean;
}

function getCustomerStatus(
  returnCase: ReturnCase,
): CustomerStatus {
  /*
   * Customer-facing status is intentionally derived from the
   * internal case without exposing internal risk information.
   */

  if (
    returnCase.reviewer_disposition?.action ===
    'DECLINE_RETURN'
  ) {
    return 'DECLINED';
  }

  if (
    returnCase.reviewer_disposition?.action ===
    'APPROVE_RETURN'
  ) {
    return 'APPROVED';
  }

  if (
    returnCase.decision === 'AUTO_APPROVE'
  ) {
    return 'APPROVED';
  }

  if (
    returnCase.review_status === 'OPEN' ||
    returnCase.decision === 'NEEDS_REVIEW'
  ) {
    return 'UNDER_REVIEW';
  }

  return 'PROCESSING';
}

function getStatusTitle(
  status: CustomerStatus,
): string {
  switch (status) {
    case 'PROCESSING':
      return 'Return request received';

    case 'UNDER_REVIEW':
      return 'Your return request is under review';

    case 'APPROVED':
      return 'Return approved';

    case 'DECLINED':
      return 'Return declined';
  }
}

function getStatusMessage(
  status: CustomerStatus,
): string {
  switch (status) {
    case 'PROCESSING':
      return 'Your return request has been received and is being processed.';

    case 'UNDER_REVIEW':
      return 'We will update you when a decision is available.';

    case 'APPROVED':
      return 'Please follow the return instructions provided by the seller.';

    case 'DECLINED':
      return 'The return request did not meet the return policy requirements.';
  }
}

function getStatusClass(
  status: CustomerStatus,
): string {
  switch (status) {
    case 'PROCESSING':
      return 'return-result return-result--processing';

    case 'UNDER_REVIEW':
      return 'return-result return-result--review';

    case 'APPROVED':
      return 'return-result return-result--approved';

    case 'DECLINED':
      return 'return-result return-result--declined';
  }
}

/**
 * Customer-facing return request flow.
 *
 * This component deliberately exposes only customer-safe information.
 * Internal risk score, seller history, contributions, evidence details,
 * AI reasoning and reviewer information stay inside the Operations Center.
 */
export const ReturnForm: FC = () => {
  const [form, setForm] = useState<FormState>({
    order_id: '',
    reason: 'CHANGED_MIND',
    evidence_text: '',
  });

  const [result, setResult] =
    useState<CustomerResult | null>(null);

  const [error, setError] =
    useState<ApiError | string | null>(null);

  const [busy, setBusy] = useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    const orderId = form.order_id.trim();

    if (!orderId) {
      setError('Order ID is required.');
      return;
    }

    setBusy(true);
    setError(null);
    setResult(null);

    const evidenceText =
      form.evidence_text.trim();

    const idempotencyKey =
      crypto.randomUUID();

    try {
      const response =
        await apiClient.createReturn(
          {
            schema_version: '1.0.0',

            order_id: orderId,

            reason: form.reason,

            evidence:
              evidenceText.length > 0
                ? [
                    {
                      schema_version: '1.0.0',

                      evidence_id:
                        crypto.randomUUID(),

                      kind:
                        'RETURN_STATEMENT',

                      source_id: orderId,

                      text: evidenceText,

                      observed_at:
                        new Date().toISOString(),
                    },
                  ]
                : [],
          },
          idempotencyKey,
        );

      const data =
        response.data;

      setResult({
        case_id:
          data.case.case_id,

        status:
          getCustomerStatus(data.case),

        replayed:
          data.replayed,
      });
    } catch (cause) {
      if (cause instanceof ApiError) {
        setError(cause);
      } else if (cause instanceof Error) {
        setError(cause.message);
      } else {
        setError(
          'Failed to submit the return request.',
        );
      }
    } finally {
      setBusy(false);
    }
  }

  function resetForm(): void {
    setForm({
      order_id: '',
      reason: 'CHANGED_MIND',
      evidence_text: '',
    });

    setResult(null);
    setError(null);
  }

  return (
    <section className="return-form">
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <p className="page__eyebrow">
          Customer
        </p>

        <h2 className="panel__title">
          Request a return
        </h2>

        <p className="panel__body">
          Submit a return request for an order.
          ReturnShield evaluates the request in
          the background.
        </p>
      </div>

      {!result && (
        <form
          onSubmit={handleSubmit}
          noValidate
        >
          <div>
            <label htmlFor="return-order-id">
              Order ID
            </label>

            <input
              id="return-order-id"
              name="order_id"
              type="text"
              value={form.order_id}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  order_id:
                    event.target.value,
                }))
              }
              required
              disabled={busy}
              placeholder="Enter the order ID"
              autoComplete="off"
            />
          </div>

          <div>
            <label htmlFor="return-reason">
              Return reason
            </label>

            <select
              id="return-reason"
              name="reason"
              value={form.reason}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  reason:
                    event.target.value as ReturnReason,
                }))
              }
              disabled={busy}
            >
              {RETURN_REASONS.map(
                (reason) => (
                  <option
                    key={reason.value}
                    value={reason.value}
                  >
                    {reason.label}
                  </option>
                ),
              )}
            </select>
          </div>

          <div>
            <label htmlFor="return-evidence">
              Additional information
            </label>

            <textarea
              id="return-evidence"
              name="evidence_text"
              rows={5}
              value={form.evidence_text}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  evidence_text:
                    event.target.value,
                }))
              }
              disabled={busy}
              placeholder="Add any information that may help explain the return."
            />
          </div>

          <button
            type="submit"
            disabled={busy}
          >
            {busy
              ? 'Submitting…'
              : 'Submit return request'}
          </button>
        </form>
      )}

      {error && (
        <div
          style={{
            marginTop:
              'var(--space-4)',
          }}
        >
          <ErrorState
            error={error}
          />
        </div>
      )}

      {result && (
        <div
          className={getStatusClass(
            result.status,
          )}
          style={{
            marginTop:
              'var(--space-4)',
            padding:
              'var(--space-4)',
            border:
              '1px solid var(--line)',
            borderRadius:
              'var(--radius)',
            background:
              result.status ===
              'APPROVED'
                ? 'var(--ok-surface)'
                : result.status ===
                    'DECLINED'
                  ? 'var(--danger-surface)'
                  : result.status ===
                      'UNDER_REVIEW'
                    ? 'var(--warn-surface)'
                    : 'var(--surface-raised)',
          }}
          aria-live="polite"
        >
          <h3
            style={{
              marginBottom:
                'var(--space-2)',
            }}
          >
            {getStatusTitle(
              result.status,
            )}
          </h3>

          <p
            style={{
              marginBottom:
                'var(--space-2)',
            }}
          >
            {getStatusMessage(
              result.status,
            )}
          </p>

          <p>
            Case ID:{' '}
            <strong>
              {result.case_id}
            </strong>
          </p>

          {result.status ===
            'PROCESSING' && (
            <p className="panel__meta">
              Status: Processing
            </p>
          )}

          {result.status ===
            'UNDER_REVIEW' && (
            <p className="panel__meta">
              Status: Under review
            </p>
          )}

          {result.status ===
            'APPROVED' && (
            <p className="panel__meta">
              Status: Approved
            </p>
          )}

          {result.status ===
            'DECLINED' && (
            <p className="panel__meta">
              Status: Declined
            </p>
          )}

          {result.replayed && (
            <p
              className="panel__meta"
              style={{
                marginTop:
                  'var(--space-2)',
              }}
            >
              This request was already
              submitted, so the existing
              result was returned.
            </p>
          )}

          <button
            type="button"
            onClick={resetForm}
            style={{
              marginTop:
                'var(--space-3)',
            }}
          >
            Submit another return
          </button>
        </div>
      )}
    </section>
  );
};

export default ReturnForm;
