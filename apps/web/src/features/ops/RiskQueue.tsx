import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import type { ReturnCase } from '../../api/types';
import { Badge } from '../../components/Badge/Badge';
import { DataTable } from '../../components/DataTable/DataTable';
export function RiskQueue() {
  const nav = useNavigate();
  const [items, setItems] = useState<ReturnCase[]>([]),
    [query, setQuery] = useState(''),
    [priority, setPriority] = useState(''),
    [status, setStatus] = useState(''),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await apiClient.getCases({
        limit: 100,
        priority: priority || undefined,
        review_status: status || undefined,
      });
      setItems(r.data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Queue could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [priority, status]);
  useEffect(() => {
    void load();
  }, [load]);
  const rows = useMemo(
    () =>
      items.filter((c) =>
        [c.case_id, c.order_id, c.seller_id, c.reason].some((v) =>
          v.toLowerCase().includes(query.toLowerCase()),
        ),
      ),
    [items, query],
  );
  return (
    <section id="queue" className="surface queue-card">
      <div className="section-heading queue-heading">
        <div>
          <span className="eyebrow">Analyst workspace</span>
          <h2>Risk review queue</h2>
          <p>Cases ranked for human review. Policy scores remain immutable.</p>
        </div>
        <button className="button-secondary" onClick={() => void load()}>
          ↻ Refresh
        </button>
      </div>
      <div className="filters">
        <label className="filter-search">
          <span>⌕</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search cases, orders or sellers"
          />
        </label>
        <select value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="">All priorities</option>
          <option value="HIGH">High priority</option>
          <option value="NORMAL">Normal priority</option>
          <option value="NONE">No review</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All review states</option>
          <option value="OPEN">Open</option>
          <option value="RESOLVED">Resolved</option>
        </select>
        <span className="result-count">{rows.length} cases</span>
      </div>
      {error ? (
        <div className="inline-error">
          {error} <button onClick={() => void load()}>Retry</button>
        </div>
      ) : loading ? (
        <div className="skeleton-table" />
      ) : (
        <DataTable<ReturnCase & Record<string, unknown>>
          rows={rows as Array<ReturnCase & Record<string, unknown>>}
          onRowClick={(row) => nav(`/ops/cases/${row.case_id}`)}
          columns={[
            {
              key: 'case_id',
              header: 'Case',
              render: (r) => (
                <div className="primary-cell">
                  <strong>{r.case_id}</strong>
                  <span>{new Date(r.created_at).toLocaleDateString()}</span>
                </div>
              ),
            },
            {
              key: 'risk_score',
              header: 'Risk',
              render: (r) => (
                <span
                  className={`risk-number risk-${(r.risk_score ?? 0) >= 60 ? 'high' : (r.risk_score ?? 0) >= 30 ? 'medium' : 'low'}`}
                >
                  {r.risk_score ?? '—'}
                </span>
              ),
            },
            { key: 'priority', header: 'Priority', render: (r) => <Badge kind={r.priority} /> },
            {
              key: 'seller_id',
              header: 'Seller',
              render: (r) => (
                <div className="primary-cell">
                  <strong>{r.seller_id}</strong>
                  <span>{r.listing_id}</span>
                </div>
              ),
            },
            {
              key: 'reason',
              header: 'Return reason',
              render: (r) => <span>{r.reason.replaceAll('_', ' ')}</span>,
            },
            {
              key: 'review_status',
              header: 'Review',
              render: (r) => <Badge kind={r.review_status} />,
            },
            { key: 'action', header: '', render: () => <span className="row-arrow">→</span> },
          ]}
        />
      )}
    </section>
  );
}
