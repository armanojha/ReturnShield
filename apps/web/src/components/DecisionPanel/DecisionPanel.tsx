import { useState } from 'react';
import type { FormEvent } from 'react';

import {
  ApiError,
  apiClient,
} from '../../api/client';

import type {
  ReturnCase,
} from '../../api/types';

interface DecisionPanelProps {
  value: ReturnCase;
  onDecision: (
    next: ReturnCase,
  ) => void;
}

type DecisionAction =
  | 'APPROVE_RETURN'
  | 'DECLINE_RETURN';

function formatDecision(
  action:
    | DecisionAction
    | null
    | undefined,
): string {
  switch (action) {
    case 'APPROVE_RETURN':
      return 'Return approved';

    case 'DECLINE_RETURN':
      return 'Return declined';

    default:
      return 'Decision recorded';
  }
}

export function DecisionPanel({
  value,
  onDecision,
}: DecisionPanelProps): JSX.Element {
  const [
    action,
    setAction,
  ] = useState<DecisionAction>(
    'APPROVE_RETURN',
  );

  const [
    note,
    setNote,
  ] = useState('');

  const [
    busy,
    setBusy,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<
    ApiError | string | null
  >(null);

  const resolved =
    value.review_status !== 'OPEN';

  async function submit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    const trimmedNote =
      note.trim();

    if (!trimmedNote) {
      setError(
        'A decision note is required.',
      );
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const response =
        await apiClient.postDecision(
          value.case_id,
          {
            action,
            note: trimmedNote,
            expected_revision:
              value.revision,
          },
          crypto.randomUUID(),
        );

      onDecision(
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
        setError(cause.message);
      } else {
        setError(
          'The reviewer decision could not be saved.',
        );
      }
    } finally {
      setBusy(false);
    }
  }

  if (resolved) {
    const disposition =
      value.reviewer_disposition;

    return (
      <section className="decision-complete">
        <span
          aria-hidden="true"
        >
          ✓
        </span>

        <div>
          <strong>
            {formatDecision(
              disposition?.action as DecisionAction | undefined,
            )}
          </strong>

          <p>
            {disposition?.note?.trim()
              ? disposition.note
              : 'A reviewer disposition has been recorded.'}
          </p>

          {disposition?.decided_at && (
            <small>
              Recorded{' '}
              {new Intl.DateTimeFormat(
                undefined,
                {
                  dateStyle:
                    'medium',
                  timeStyle:
                    'short',
                },
              ).format(
                new Date(
                  disposition.decided_at,
                ),
              )}
            </small>
          )}
        </div>
      </section>
    );
  }

  return (
    <form
      className="decision-panel"
      onSubmit={submit}
    >
      <div className="decision-options">
        <button
          type="button"
          className={
            action ===
            'APPROVE_RETURN'
              ? 'selected approve'
              : ''
          }
          onClick={() =>
            setAction(
              'APPROVE_RETURN',
            )
          }
          disabled={busy}
          aria-pressed={
            action ===
            'APPROVE_RETURN'
          }
        >
          <span
            aria-hidden="true"
          >
            ✓
          </span>

          <div>
            <strong>
              Approve return
            </strong>

            <small>
              Approve the customer's
              return request.
            </small>
          </div>
        </button>

        <button
          type="button"
          className={
            action ===
            'DECLINE_RETURN'
              ? 'selected decline'
              : ''
          }
          onClick={() =>
            setAction(
              'DECLINE_RETURN',
            )
          }
          disabled={busy}
          aria-pressed={
            action ===
            'DECLINE_RETURN'
          }
        >
          <span
            aria-hidden="true"
          >
            ×
          </span>

          <div>
            <strong>
              Decline return
            </strong>

            <small>
              Decline the request with
              reviewer rationale.
            </small>
          </div>
        </button>
      </div>

      <label>
        Decision note
        <textarea
          required
          minLength={1}
          maxLength={4000}
          rows={5}
          value={note}
          onChange={(event) =>
            setNote(
              event.target.value,
            )
          }
          disabled={busy}
          placeholder="Document the evidence and rationale behind this decision."
        />
      </label>

      {error && (
        <div
          className="form-error"
          role="alert"
        >
          {error instanceof ApiError
            ? error.message
            : error}
        </div>
      )}

      <button
        type="submit"
        className="button-primary"
        disabled={
          busy ||
          !note.trim()
        }
      >
        {busy
          ? 'Saving decision…'
          : action ===
              'APPROVE_RETURN'
            ? 'Confirm approval'
            : 'Confirm decline'}
      </button>
    </form>
  );
}

export default DecisionPanel;
