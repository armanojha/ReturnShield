import { FC, PropsWithChildren } from 'react';
import { ApiError } from '../../api/client';

/** Error state with retry action. */
export const ErrorState: FC<PropsWithChildren<{
  error: ApiError | Error | string;
  onRetry?: () => void;
}>> = ({ error, onRetry }) => {
  const message = error instanceof ApiError ? error.message : error instanceof Error ? error.message : error;

  return (
    <div className="error-state" style={{ padding: 'var(--space-4)', background: 'var(--danger-surface)', border: '1px solid var(--danger)', borderRadius: 'var(--radius)', color: 'var(--danger)' }}>
      <h3 style={{ marginBottom: 'var(--space-2)' }}>Error</h3>
      <p style={{ marginBottom: 'var(--space-3)' }}>{message}</p>
      {onRetry && (
        <button onClick={onRetry} style={{ padding: 'var(--space-2) var(--space-4)', border: '1px solid var(--danger)', borderRadius: 'var(--radius)', background: 'transparent', color: 'var(--danger)', fontWeight: 600, cursor: 'pointer' }}>
          Retry
        </button>
      )}
    </div>
  );
};