import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiClient } from '../../api/client';
import type { Seller } from '../../api/types';
import { MetricCard } from '../../components/MetricCard/MetricCard';
import { ErrorState } from '../../components/ErrorState/ErrorState';
export function SellerProfile() {
  const { sellerId = '' } = useParams(),
    [seller, setSeller] = useState<Seller>(),
    [error, setError] = useState('');
  useEffect(() => {
    apiClient
      .getSeller(sellerId)
      .then((r) => setSeller(r.data))
      .catch((e) => setError(e instanceof Error ? e.message : 'Seller unavailable.'));
  }, [sellerId]);
  if (error) return <ErrorState error={error} />;
  if (!seller)
    return (
      <div className="page-loader">
        <span />
        Loading seller profile…
      </div>
    );
  return (
    <div className="dashboard">
      <div className="breadcrumbs">
        <Link to="/ops">Overview</Link>
        <span>/</span>
        <strong>{seller.seller_id}</strong>
      </div>
      <div className="dashboard-header">
        <div>
          <span className="eyebrow">Seller intelligence</span>
          <h1>{seller.seller_id}</h1>
          <p>Marketplace trust and return behavior from the current synthetic dataset.</p>
        </div>
      </div>
      <section className="metric-grid">
        <MetricCard
          label="Trust score"
          value={seller.trust_score}
          kind={seller.trust_score >= 80 ? 'ok' : seller.trust_score >= 50 ? 'warn' : 'danger'}
        />
        <MetricCard
          label="Return rate"
          value={`${(seller.return_rate * 100).toFixed(1)}%`}
          kind={seller.return_rate >= 0.2 ? 'danger' : 'ok'}
        />
        <MetricCard
          label="Disputes"
          value={seller.dispute_count}
          kind={seller.dispute_count >= 3 ? 'danger' : 'neutral'}
        />
        <MetricCard
          label="Listing flags"
          value={seller.listing_flags}
          kind={seller.listing_flags ? 'warn' : 'ok'}
        />
      </section>
      <section className="surface seller-cases">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Linked investigations</span>
            <h2>Case history</h2>
          </div>
        </div>
        {seller.cases.length ? (
          seller.cases.map((id) => (
            <Link key={id} to={`/ops/cases/${id}`}>
              <strong>{id}</strong>
              <span>Open investigation →</span>
            </Link>
          ))
        ) : (
          <div className="empty-panel">No return cases are linked to this seller.</div>
        )}
      </section>
    </div>
  );
}
