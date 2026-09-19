import { useApi } from '../api/useApi';
import { getHealth } from '../api/client';

export function HealthIndicator(): JSX.Element {
  const {
    data,
    loading,
    error,
    refresh,
  } = useApi(
    getHealth,
    [],
  );

  if (loading && !data) {
    return (
      <div className="health health--loading">
        <span className="health-dot" />
        <span>Connecting…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="health health--error">
        <span className="health-dot" />

        <span>
          API unavailable
        </span>

        <button
          type="button"
          onClick={refresh}
          className="health-refresh"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="health health--ok">
      <span className="health-dot" />

      <span>
        {data?.data?.service ??
          'API connected'}
      </span>

      <button
        type="button"
        onClick={refresh}
        className="health-refresh"
      >
        Refresh
      </button>
    </div>
  );
}
