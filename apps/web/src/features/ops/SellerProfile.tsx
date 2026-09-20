import { FC, useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import { MetricCard } from '../../components/MetricCard/MetricCard';
import { Badge } from '../../components/Badge/Badge';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { ErrorState } from '../../components/ErrorState/ErrorState';

/** Seller Profile screen. */
export const SellerProfile: FC<{ sellerId: string }> = ({ sellerId }) => {
  const [seller, setSeller] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await apiClient.getSeller(sellerId);
        setSeller(res.data);
      } catch (err: any) {
        setError(err.message || 'Failed to load seller');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [sellerId]);

  if (loading) return <div style={{ padding: 'var(--space-4)' }}>Loading…</div>;
  if (error) return <ErrorState error={error} onRetry={() => window.location.reload()} />;
  if (!seller) return <EmptyState title="Seller not found" />;

  return (
    <div className="seller-profile">
      <div className="seller-profile__metrics" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <MetricCard label="Trust Score" value={seller.trust_score} kind={seller.trust_score >= 80 ? 'ok' : seller.trust_score >= 50 ? 'warn' : 'danger'} />
        <MetricCard label="Listing Flags" value={seller.listing_flags} kind={seller.listing_flags === 0 ? 'ok' : 'warn'} />
        <MetricCard label="Return Rate" value={`${(seller.return_rate * 100).toFixed(1)}%`} kind={seller.return_rate < 0.1 ? 'ok' : seller.return_rate < 0.2 ? 'warn' : 'danger'} />
        <MetricCard label="Dispute Count" value={seller.dispute_count} kind={seller.dispute_count === 0 ? 'ok' : seller.dispute_count < 3 ? 'warn' : 'danger'} />
      </div>

      <div className="seller-profile__cases">
        <h3 style={{ marginBottom: 'var(--space-3)' }}>Case History</h3>
        {seller.cases?.length > 0 ? (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {seller.cases.map((caseId: string, i: number) => (
              <li key={i} style={{ padding: 'var(--space-2)', borderBottom: '1px solid var(--border)' }}>
                <a href={`/ops/cases/${caseId}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>{caseId}</a>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No cases" message="This seller has no return cases." />
        )}
      </div>
    </div>
  );
};