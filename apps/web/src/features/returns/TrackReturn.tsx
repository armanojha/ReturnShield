import {
  useState,
} from 'react';

import type {
  FC,
  FormEvent,
} from 'react';

import {
  ApiError,
  apiClient,
} from '../../api/client';

import {
  ErrorState,
} from '../../components/ErrorState/ErrorState';

import type {
  ReturnCase,
} from '../../api/types';

type CustomerStatus =
  | 'PROCESSING'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'DECLINED';

interface CustomerReturnStatus {
  caseId: string;
  status: CustomerStatus;
}

function getCustomerStatus(
  returnCase: ReturnCase,
): CustomerStatus {
  /*
   * Reviewer disposition is checked first because a case can have an
   * internal policy decision of NEEDS_REVIEW while the human reviewer
   * has already resolved it.
   */
  if (
    returnCase.reviewer_disposition?.action ===
    'APPROVE_RETURN'
  ) {
    return 'APPROVED';
  }

  if (
    returnCase.reviewer_disposition?.action ===
    'DECLINE_RETURN'
  ) {
    return 'DECLINED';
  }

  /*
   * Automatic approval is an internal decision that is safe to translate
   * into the customer-facing approved state.
   */
  if (
    returnCase.decision ===
    'AUTO_APPROVE'
  ) {
    return 'APPROVED';
  }

  /*
   * NEEDS_REVIEW and an open review are represented to the customer only
   * as "Under review".
   */
  if (
    returnCase.decision ===
      'NEEDS_REVIEW' ||
    returnCase.review_status === 'OPEN'
  ) {
    return 'UNDER_REVIEW';
  }

  /*
   * Processing also covers cases whose final internal state is not yet
   * available to the customer.
   */
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

function getResultClass(
  status: CustomerStatus,
): string {
  switch (status) {
    case 'PROCESSING':
      return 'track-return__result track-return__result--processing';

    case 'UNDER_REVIEW':
      return 'track-return__result track-return__result--review';

    case 'APPROVED':
      return 'track-return__result track-return__result--approved';

    case 'DECLINED':
      return 'track-return__result track-return__result--declined';
  }
}

/**
 * Customer-facing return tracking.
 *
 * Only customer-safe information is rendered from the internal case response.
 */
export const TrackReturn: FC = () => {
  const [caseId, setCaseId] =
    useState('');

  const [result, setResult] =
    useState<CustomerReturnStatus | null>(
      null,
    );

  const [error, setError] =
    useState<ApiError | string | null>(
      null,
    );

  const [busy, setBusy] =
    useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    const trimmedCaseId =
      caseId.trim();

    if (!trimmedCaseId) {
      setError(
        'Enter the case ID from your return request.',
      );
      setResult(null);
      return;
    }

    setBusy(true);
    setError(null);
    setResult(null);

    try {
      /*
       * The current backend exposes case lookup rather than a separate
       * customer-safe return-status endpoint. We therefore consume the
       * existing response but intentionally map it to a customer-safe
       * representation before storing it in component state.
       */
      const response =
        await apiClient.getCase(
          trimmedCaseId,
        );

      const returnCase =
        response.data;

      setResult({
        caseId:
          returnCase.case_id,

        status:
          getCustomerStatus(
            returnCase,
          ),
      });
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
          'The return status could not be retrieved.',
        );
      }
    } finally {
      setBusy(false);
    }
  }

  function reset(): void {
    setCaseId('');
    setResult(null);
    setError(null);
  }

  return (
    <section className="track-return">
      <div
        style={{
          marginBottom:
            'var(--space-4)',
        }}
      >
        <p className="page__eyebrow">
          Customer
        </p>

        <h2 className="panel__title">
          Track your return
        </h2>

        <p className="panel__body">
          Check the current status of a
          return request using the case ID
          you received after submission.
        </p>
      </div>

      {!result && (
        <form
          onSubmit={handleSubmit}
          style={{
            maxWidth: '520px',
          }}
        >
          <div>
            <label htmlFor="return-case-id">
              Case ID
            </label>

            <input
              id="return-case-id"
              name="case_id"
              type="text"
              value={caseId}
              onChange={(event) =>
                setCaseId(
                  event.target.value,
                )
              }
              placeholder="Enter your case ID"
              autoComplete="off"
              required
              disabled={busy}
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            style={{
              marginTop:
                'var(--space-3)',
            }}
          >
            {busy
              ? 'Checking status…'
              : 'Check status'}
          </button>
        </form>
      )}

      {error && (
        <div
          style={{
            marginTop:
              'var(--space-4)',
            maxWidth: '520px',
          }}
        >
          <ErrorState
            error={error}
          />
        </div>
      )}

      {result && (
        <section
          className={getResultClass(
            result.status,
          )}
          aria-live="polite"
          style={{
            marginTop:
              'var(--space-4)',
            maxWidth: '520px',
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
        >
          <p className="page__eyebrow">
            Return status
          </p>

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

          <p>
            {getStatusMessage(
              result.status,
            )}
          </p>

          <p
            style={{
              marginTop:
                'var(--space-3)',
            }}
          >
            Case ID:{' '}
            <strong>
              {result.caseId}
            </strong>
          </p>

          <button
            type="button"
            onClick={() => {
              /*
               * Returning to the lookup form allows the customer to
               * explicitly refresh/check again later.
               */
              setResult(null);
              setError(null);
            }}
            style={{
              marginTop:
                'var(--space-3)',
            }}
          >
            Check again
          </button>
        </section>
      )}

      {result && (
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop:
              'var(--space-2)',
            background:
              'transparent',
            color:
              'var(--text)',
            border:
              '1px solid var(--border)',
          }}
        >
          Use another case ID
        </button>
      )}
    </section>
  );
};

export default TrackReturn;
