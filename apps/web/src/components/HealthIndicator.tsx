import { useHealth } from '../api/useHealth';

/**
 * Visible service-health indicator, rendered on both `/marketplace` and `/ops`.
 *
 * It distinguishes the three states explicitly. A failed or still-loading check
 * is never shown as healthy.
 */
export function HealthIndicator(): JSX.Element {
  const { state, refresh } = useHealth();

  if (state.status === 'loading') {
    return (
      <div className="health health--loading" role="status" aria-live="polite">
        <span className="health__dot" aria-hidden="true" />
        <span className="health__label">Checking service health…</span>
      </div>
    );
  }

  if (state.status === 'error') {
    const detail =
      state.error.kind === 'timeout'
        ? 'The service did not respond in time.'
        : state.error.kind === 'network'
          ? 'The service could not be reached.'
          : state.error.kind === 'contract'
            ? 'The service replied with an unrecognised response.'
            : state.error.message;

    return (
      <div className="health health--error" role="alert">
        <span className="health__dot" aria-hidden="true" />
        <span className="health__label">Service health unavailable</span>
        <span className="health__detail">{detail}</span>
        <button type="button" className="health__retry" onClick={refresh}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="health health--ok" role="status" aria-live="polite">
      <span className="health__dot" aria-hidden="true" />
      <span className="health__label">Service healthy</span>
      <span className="health__detail">
        {state.response.data.service} · checked{' '}
        {state.checkedAt.toLocaleTimeString([], { hour12: false })}
      </span>
      <button type="button" className="health__retry" onClick={refresh}>
        Refresh
      </button>
    </div>
  );
}
