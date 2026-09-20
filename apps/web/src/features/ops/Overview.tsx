import { FC, useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import { MetricCard } from '../../components/MetricCard/MetricCard';
import { DataTable } from '../../components/DataTable/DataTable';
import { Badge } from '../../components/Badge/Badge';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { ErrorState } from '../../components/ErrorState/ErrorState';
import { apiClient } from '../../api/client';

/** Overview dashboard with metrics and open cases shortcut. */
export const Overview: FC = () => {
  const [metrics, setMetrics] = useState<any>(null);
  const [openCases, setOpenCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [dashboard, cases] = await Promise.all([
          apiClient.getDashboard(),
          apiClient.getCases({ review_status: 'OPEN', limit: 10 }),
        ]);
        setMetrics(dashboard.data);
        setOpenCases(cases.data.items);
      } catch (err: any) {
        setError(err.message || 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <div style={{ padding: 'var(--space-4)' }}>Loading…</div>;
  if (error) return <ErrorState error={error} onRetry={() => window.location.reload()} />;

  return (
    <div className="overview">
      <div className="overview__metrics" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <MetricCard label="Flagged Listings" value={metrics?.flagged_listings ?? 0} kind="warn" />
        <MetricCard label="Auto-Approved Returns" value={metrics?.auto_approved_returns ?? 0} kind="ok" />
        <MetricCard label="Normal Review Cases" value={metrics?.normal_review_cases ?? 0} kind="warn" />
        <MetricCard label="High Review Cases" value={metrics?.high_review_cases ?? 0} kind="danger" />
        <MetricCard label="Open Review Cases" value={metrics?.open_review_cases ?? 0} kind="danger" />
        <MetricCard label="Missing Context" value={metrics?.missing_context_cases ?? 0} kind="neutral" />
      </div>

      <div className="overview__open-cases">
        <h3 style={{ marginBottom: 'var(--space-3)' }}>Needs Attention</h3>
        {openCases.length === 0 ? (
          <EmptyState title="No open review cases" message="All cases are resolved or auto-approved." />
        ) : (
          <DataTable
            columns={[
              { key: 'case_id', header: 'Case ID', width: '140px' },
              { key: 'risk_score', header: 'Score', width: '80px', render: (r) => <span style={{ fontWeight: 600 }}>{r.risk_score}</span> },
              { key: 'priority', header: 'Priority', width: '100px', render: (r) => <Badge kind={r.priority}>{r.priority}</Badge> },
              { key: 'seller_id', header: 'Seller', width: '140px' },
              { key: 'listing_id', header: 'Listing', width: '140px' },
              { key: 'reason', header: 'Reason', width: '160px' },
              { key: 'decision', header: 'Decision', width: '140px', render: (r) => <Badge kind={r.decision}>{r.decision}</Badge> },
              { key: 'review_status', header: 'Review', width: '120px', render: (r) => <Badge kind={r.review_status}>{r.review_status}</Badge> },
            ]}
            rows={openCases}
            onRowClick={(row) => window.location.href = `/ops/cases/${row.case_id}`}
          />
        )}
      </div>
    </div>
  );
};