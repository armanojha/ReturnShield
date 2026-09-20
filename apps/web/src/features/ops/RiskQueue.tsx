import { FC, useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import { DataTable } from '../../components/DataTable/DataTable';
import { Badge } from '../../components/Badge/Badge';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { ErrorState } from '../../components/ErrorState/ErrorState';

/** Risk Queue with filters and pagination. */
export const RiskQueue: FC = () => {
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    decision: '',
    review_status: '',
    seller_id: '',
  });

  const load = async () => {
    try {
      setLoading(true);
      const res = await apiClient.getCases({ ...filters, limit: 25, cursor: cursor || undefined });
      setCases(res.data.items);
      setCursor(res.data.next_cursor);
    } catch (err: any) {
      setError(err.message || 'Failed to load cases');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filters, cursor]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCursor(null);
  };

  if (loading) return <div style={{ padding: 'var(--space-4)' }}>Loading…</div>;
  if (error) return <ErrorState error={error} onRetry={load} />;

  return (
    <div className="risk-queue">
      <div className="risk-queue__filters" style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', marginBottom: 'var(--space-4)', alignItems: 'flex-end' }}>
        <select value={filters.status} onChange={(e) => handleFilterChange('status', e.target.value)} style={{ padding: 'var(--space-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text)' }}>
          <option value="">All Status</option>
          <option value="PROCESSING">PROCESSING</option>
          <option value="DECIDED">DECIDED</option>
          <option value="ERROR_MISSING_CONTEXT">ERROR_MISSING_CONTEXT</option>
          <option value="FAILED">FAILED</option>
        </select>
        <select value={filters.priority} onChange={(e) => handleFilterChange('priority', e.target.value)} style={{ padding: 'var(--space-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text)' }}>
          <option value="">All Priority</option>
          <option value="NONE">NONE</option>
          <option value="NORMAL">NORMAL</option>
          <option value="HIGH">HIGH</option>
        </select>
        <select value={filters.decision} onChange={(e) => handleFilterChange('decision', e.target.value)} style={{ padding: 'var(--space-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text)' }}>
          <option value="">All Decision</option>
          <option value="AUTO_APPROVE">AUTO_APPROVE</option>
          <option value="NEEDS_REVIEW">NEEDS_REVIEW</option>
        </select>
        <select value={filters.review_status} onChange={(e) => handleFilterChange('review_status', e.target.value)} style={{ padding: 'var(--space-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text)' }}>
          <option value="">All Review</option>
          <option value="OPEN">OPEN</option>
          <option value="RESOLVED">RESOLVED</option>
          <option value="NOT_APPLICABLE">NOT_APPLICABLE</option>
        </select>
        <input
          type="text"
          placeholder="Seller ID"
          value={filters.seller_id}
          onChange={(e) => handleFilterChange('seller_id', e.target.value)}
          style={{ padding: 'var(--space-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text)', width: '200px' }}
        />
      </div>

      {cases.length === 0 ? (
        <EmptyState title="No cases found" message="Try adjusting your filters." />
      ) : (
        <>
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
              { key: 'updated_at', header: 'Updated', width: '180px', render: (r) => new Date(r.updated_at).toLocaleString() },
            ]}
            rows={cases}
            onRowClick={(row) => window.location.href = `/ops/cases/${row.case_id}`}
          />
          {cursor && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 'var(--space-4)' }}>
              <button onClick={() => setCursor(cursor)} style={{ padding: 'var(--space-2) var(--space-4)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }}>
                Load More
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};