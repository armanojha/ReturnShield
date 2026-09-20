import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiClient } from '../../api/client';
import type { ImageEvidence, Listing, ReturnCase } from '../../api/types';
import { Badge } from '../../components/Badge/Badge';
import { ScoreGauge } from '../../components/ScoreGauge/ScoreGauge';
import { SignalBar } from '../../components/SignalBar/SignalBar';
import { DecisionPanel } from '../../components/DecisionPanel/DecisionPanel';
import { ErrorState } from '../../components/ErrorState/ErrorState';
export function CaseDetail() {
  const { caseId = '' } = useParams();
  const [value, setValue] = useState<ReturnCase>(),
    [listing, setListing] = useState<Listing>(),
    [images, setImages] = useState<ImageEvidence[]>([]),
    [error, setError] = useState('');
  const load = useCallback(async () => {
    setError('');
    try {
      const c = await apiClient.getCase(caseId);
      setValue(c.data);
      const [l, i] = await Promise.all([
        apiClient.getListing(c.data.listing_id).catch(() => null),
        apiClient.getCaseImages(caseId).catch(() => null),
      ]);
      setListing(l?.data);
      setImages(i?.data.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Case could not be loaded.');
    }
  }, [caseId]);
  useEffect(() => {
    void load();
  }, [load]);
  if (error) return <ErrorState error={error} onRetry={load} />;
  if (!value)
    return (
      <div className="page-loader">
        <span />
        Loading case intelligence…
      </div>
    );
  const explanation = value.explanation;
  return (
    <div className="case-page">
      <div className="breadcrumbs">
        <Link to="/ops">Overview</Link>
        <span>/</span>
        <Link to="/ops#queue">Risk queue</Link>
        <span>/</span>
        <strong>{value.case_id}</strong>
      </div>
      <div className="case-hero">
        <div>
          <span className="eyebrow">Return investigation</span>
          <h1>{value.case_id}</h1>
          <div className="badge-row">
            <Badge kind={value.priority} />
            <Badge kind={value.review_status} />
            <Badge kind={value.decision} />
          </div>
        </div>
        <div className="case-meta">
          <div>
            <span>Order</span>
            <strong>{value.order_id}</strong>
          </div>
          <div>
            <span>Seller</span>
            <Link to={`/ops/sellers/${value.seller_id}`}>{value.seller_id}</Link>
          </div>
          <div>
            <span>Last updated</span>
            <strong>{new Date(value.updated_at).toLocaleString()}</strong>
          </div>
        </div>
      </div>
      <div className="case-layout">
        <div className="case-primary">
          <section className="surface risk-summary">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Deterministic assessment</span>
                <h2>Risk composition</h2>
              </div>
              <ScoreGauge score={value.risk_score ?? 0} size="lg" />
            </div>
            <div className="signals">
              {value.contributions.map((c) => (
                <SignalBar key={c.risk_event_id} {...c} />
              ))}
            </div>
            <p className="raw-score">
              Raw contributions <strong>{value.raw_contribution_total ?? '—'}</strong> · clamped
              score <strong>{value.risk_score ?? '—'}</strong>
            </p>
          </section>
          <section className="surface">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Evidence grounded</span>
                <h2>AI investigator brief</h2>
              </div>
              <Badge kind={value.explanation_status} />
            </div>
            {explanation ? (
              <div className="investigator">
                <p>{explanation.summary}</p>
                <div className="factor-grid">
                  {explanation.factors?.map((f, index) => (
                    <article key={`${f.signal}-${index}`}>
                      <span>{String(index + 1).padStart(2, '0')}</span>
                      <div>
                        <strong>{f.signal}</strong>
                        <p>{f.explanation}</p>
                      </div>
                    </article>
                  ))}
                </div>
                <div className="recommendation">
                  <span>Recommended next action</span>
                  <strong>{explanation.recommended_action}</strong>
                </div>
              </div>
            ) : (
              <div className="empty-panel">
                No validated investigator explanation is available for this case.
              </div>
            )}
          </section>
          <section className="surface">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Supporting context</span>
                <h2>Evidence ledger</h2>
              </div>
              <span className="count-chip">{value.evidence.length + images.length} items</span>
            </div>
            <div className="evidence-grid">
              {value.evidence.map((item) => (
                <article key={item.evidence_id}>
                  <span className="evidence-kind">{item.kind.replaceAll('_', ' ')}</span>
                  <p>{item.text}</p>
                  <small>
                    {item.source_id} · {new Date(item.observed_at).toLocaleString()}
                  </small>
                </article>
              ))}
              {images.map((image) => (
                <article className="image-evidence" key={image.image_id}>
                  <span className="evidence-kind">IMAGE EVIDENCE</span>
                  <p>
                    {image.analysis?.summary ??
                      `${image.content_type} · ${image.width ?? '?'} × ${image.height ?? '?'}`}
                  </p>
                  <button
                    onClick={async () => {
                      const r = await apiClient.getImageDownload(image.image_id);
                      window.open(r.data.download_url, '_blank', 'noopener,noreferrer');
                    }}
                  >
                    Open secure image ↗
                  </button>
                </article>
              ))}
            </div>
          </section>
        </div>
        <aside className="case-aside">
          <section className="surface sticky-card">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Human checkpoint</span>
                <h2>Final disposition</h2>
              </div>
            </div>
            <DecisionPanel value={value} onDecision={setValue} />
          </section>
          <section className="surface listing-card">
            <span className="eyebrow">Listing context</span>
            <h3>{listing?.title ?? value.listing_id}</h3>
            <p>{listing?.description ?? 'Listing details unavailable.'}</p>
            {listing && (
              <>
                <div className="listing-facts">
                  <span>
                    Category<strong>{listing.category}</strong>
                  </span>
                  <span>
                    Guard status
                    <Badge kind={listing.status} />
                  </span>
                </div>
              </>
            )}
          </section>
          <section className="surface timeline-card">
            <span className="eyebrow">Audit trail</span>
            <h3>Case timeline</h3>
            <ol>
              {value.timeline.map((entry) => (
                <li key={entry.event_id}>
                  <i />
                  <div>
                    <strong>{entry.type.replaceAll('_', ' ')}</strong>
                    <p>{entry.message}</p>
                    <small>{new Date(entry.timestamp).toLocaleString()}</small>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}
