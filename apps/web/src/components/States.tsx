import type { ApiError } from '../api/client';

export function LoadingState({
  label = 'data',
}: {
  label?: string;
}): JSX.Element {
  return (
    <div
      className="state-card"
      role="status"
      aria-live="polite"
    >
      <div className="spinner" />

      <div>
        <strong>Loading {label}</strong>

        <p>
          Waiting for the ReturnShield API.
        </p>
      </div>
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
}: {
  error: ApiError;
  onRetry: () => void;
}): JSX.Element {
  return (
    <div
      className="state-card state-card--error"
      role="alert"
    >
      <div className="state-icon">
        !
      </div>

      <div className="state-content">
        <strong>
          Unable to load data
        </strong>

        <p>
          {error.message}
        </p>

        {error.correlationId && (
          <small>
            Correlation ID:{' '}
            {error.correlationId}
          </small>
        )}

        <button
          type="button"
          className="button button--secondary"
          onClick={onRetry}
        >
          Retry
        </button>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}): JSX.Element {
  return (
    <div className="empty-card">
      <div className="empty-icon">
        —
      </div>

      <h3>{title}</h3>

      {description && (
        <p>{description}</p>
      )}
    </div>
  );
}
