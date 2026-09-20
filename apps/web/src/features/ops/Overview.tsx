import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import type { ReturnCase } from '../../api/types';
import { MetricCard } from '../../components/MetricCard/MetricCard';
import { ErrorState } from '../../components/ErrorState/ErrorState';

export function Overview() {
  const [metrics, setMetrics] =
    useState<Awaited<ReturnType<typeof apiClient.getDashboard>>['data']>();
  const [cases, setCases] = useState<ReturnCase[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [dashboard, queue] = await Promise.all([
        apiClient.getDashboard(),
        apiClient.getCases({ limit: 100 }),
      ]);
      setMetrics(dashboard.data);
      setCases(queue.data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Dashboard could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  if (error) return <ErrorState error={error} onRetry={load} />;
  const decided = cases.filter((c) => c.status === 'DECIDED').length,
    approved = metrics?.auto_approved_returns ?? 0,
    review = (metrics?.normal_review_cases ?? 0) + (metrics?.high_review_cases ?? 0),
    approvalRate = decided ? Math.round((approved / decided) * 100) : 0;
  return (
    <>
      <section className="metric-grid">
        <MetricCard
          label="Open reviews"
          value={loading ? '—' : (metrics?.open_review_cases ?? 0)}
          kind="danger"
          detail="Cases awaiting analyst action"
        />
        <MetricCard
          label="Auto-approved"
          value={loading ? '—' : approved}
          kind="ok"
          detail={`${approvalRate}% of decided returns`}
        />
        <MetricCard
          label="High priority"
          value={loading ? '—' : (metrics?.high_review_cases ?? 0)}
          kind="warn"
          detail="Score 60 or above"
        />
        <MetricCard
          label="Flagged listings"
          value={loading ? '—' : (metrics?.flagged_listings ?? 0)}
          detail="ListingGuard corrections"
        />
      </section>
      <section className="insight-grid">
        <article className="surface chart-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Decision distribution</span>
              <h2>Return outcomes</h2>
            </div>
            <span className="live-chip">Live dataset</span>
          </div>
          <div className="distribution">
            <div
              className="donut"
              style={{ '--approved': `${approvalRate * 3.6}deg` } as React.CSSProperties}
            >
              <div>
                <strong>{decided}</strong>
                <span>decisions</span>
              </div>
            </div>
            <div className="legend">
              <div>
                <i className="green" />
                <span>Auto-approved</span>
                <strong>{approved}</strong>
              </div>
              <div>
                <i className="amber" />
                <span>Needs review</span>
                <strong>{review}</strong>
              </div>
              <div>
                <i className="red" />
                <span>Missing context</span>
                <strong>{metrics?.missing_context_cases ?? 0}</strong>
              </div>
            </div>
          </div>
        </article>
        <article className="surface system-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">System posture</span>
              <h2>Decision pipeline</h2>
            </div>
          </div>
          <div className="pipeline">
            <div>
              <span>01</span>
              <p>
                <strong>ListingGuard</strong>
                <small>Content checked by Nova</small>
              </p>
              <b>Healthy</b>
            </div>
            <div>
              <span>02</span>
              <p>
                <strong>Risk policy</strong>
                <small>Five deterministic signals</small>
              </p>
              <b>v1.0</b>
            </div>
            <div>
              <span>03</span>
              <p>
                <strong>Investigator</strong>
                <small>Evidence-grounded context</small>
              </p>
              <b>Online</b>
            </div>
          </div>
        </article>
      </section>
    </>
  );
}
