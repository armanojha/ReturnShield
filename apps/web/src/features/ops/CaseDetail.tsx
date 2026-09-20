import { FC, useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import { ScoreGauge } from '../../components/ScoreGauge/ScoreGauge';
import { SignalBar } from '../../components/SignalBar/SignalBar';
import { EvidenceList } from '../../components/EvidenceList/EvidenceList';
import { Timeline } from '../../components/Timeline/Timeline';
import { DecisionPanel } from '../../components/DecisionPanel/DecisionPanel';
import { Badge } from '../../components/Badge/Badge';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { ErrorState } from '../../components/ErrorState/ErrorState';

/** Case Investigation screen with score, signals, evidence, timeline, and decision. */
export const CaseDetail: FC<{ caseId: string }> = ({ caseId }) => {
  const [caseData, setCaseData] = useState<any>(null);
  const [listing, setListing] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [caseRes, listingRes] = await Promise.all([
          apiClient.getCase(caseId),
          apiClient.getListing(caseId).catch(() => null),
        ]);
        setCaseData(caseRes.data);
        setListing(listingRes?.data || null);
      } catch (err: any) {
        setError(err.message || 'Failed to load case');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [caseId]);

  const handleDecision = () => {
    setCaseData(prev => ({ ...prev, review_status: 'RESOLVED' }));
  };

  if (loading) return <div style={{ padding: 'var(--space-4)' }}>Loading…</div>;
  if (error) return <ErrorState error={error} onRetry={() => window.location.reload()} />;
  if (!caseData) return <EmptyState title="Case not found" />;

  const c = caseData;
  const score = c.risk_score ?? 0;
  const contributions = c.contributions || [];

  return (
    <div className="case-detail">
      <div className="case-detail__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.5rem' }}>{c.case_id}</h2>
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-1)', flexWrap: 'wrap' }}>
            <Badge kind={c.status}>{c.status}</Badge>
            <Badge kind={c.priority}>{c.priority}</Badge>
            <Badge kind={c.decision}>{c.decision}</Badge>
            <Badge kind={c.review_status}>{c.review_status}</Badge>
          </div>
        </div>
        <ScoreGauge score={score} size="lg" showBars />
      </div>

      <div className="case-detail__signals" style={{ marginBottom: 'var(--space-6)' }}>
        <h3 style={{ marginBottom: 'var(--space-3)' }}>Contributing Signals</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {contributions.map((contrib: any) => (
            <SignalBar
              key={contrib.risk_event_id}
              signal={contrib.signal}
              contribution={contrib.contribution}
              max={contrib.max}
              reason={contrib.reason}
            />
          ))}
        </div>
      </div>

      <div className="case-detail__evidence" style={{ marginBottom: 'var(--space-6)' }}>
        <h3 style={{ marginBottom: 'var(--space-3)' }}>Evidence</h3>
        <EvidenceList items={c.evidence || []} />
      </div>

      {c.explanation && c.explanation_status === 'AVAILABLE' && (
        <div className="case-detail__explanation" style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-4)', background: 'var(--surface-raised)', borderRadius: 'var(--radius)', borderLeft: '4px solid var(--accent)' }}>
          <h3 style={{ marginBottom: 'var(--space-2)' }}>AI Investigator Explanation</h3>
          <p style={{ marginBottom: 'var(--space-2)' }}>{c.explanation.summary}</p>
          <div style={{ marginBottom: 'var(--space-2)' }}>
            <strong>Factors:</strong>
            <ul style={{ marginLeft: 'var(--space-4)' }}>
              {c.explanation.factors?.map((f: any, i: number) => (
                <li key={i}>{f.signal}: {f.explanation}</li>
              ))}
            </ul>
          </div>
          <div style={{ fontWeight: 600 }}>Recommended: {c.explanation.recommended_action}</div>
        </div>
      )}

      <div className="case-detail__timeline" style={{ marginBottom: 'var(--space-6)' }}>
        <h3 style={{ marginBottom: 'var(--space-3)' }}>Timeline</h3>
        <Timeline events={c.timeline || []} />
      </div>

      {listing && (
        <div className="case-detail__listing" style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-4)', background: 'var(--surface-raised)', borderRadius: 'var(--radius)', borderLeft: '4px solid var(--text-muted)' }}>
          <h3 style={{ marginBottom: 'var(--space-2)' }}>Listing: {listing.listing_id}</h3>
          <div style={{ marginBottom: 'var(--space-1)' }}><strong>Title:</strong> {listing.title}</div>
          <div style={{ marginBottom: 'var(--space-1)' }}><strong>Description:</strong> {listing.description}</div>
          <div style={{ marginBottom: 'var(--space-1)' }}><strong>Category:</strong> {listing.category}</div>
          <div style={{ marginBottom: 'var(--space-1)' }}><strong>ListingGuard:</strong> <Badge kind={listing.status}>{listing.status}</Badge> <Badge kind={listing.listing_risk}>{listing.listing_risk}</Badge></div>
          {listing.analysis?.issues?.length > 0 && (
            <div style={{ marginTop: 'var(--space-2)' }}>
              <strong>Issues:</strong>
              <ul style={{ marginLeft: 'var(--space-4)' }}>
                {listing.analysis.issues.map((issue: any, i: number) => (
                  <li key={i}>{issue.description}</li>
                ))}
              </ul>
            </div>
          )}
          {listing.analysis?.recommended_action && (
            <div style={{ marginTop: 'var(--space-2)', fontStyle: 'italic' }}>{listing.analysis.recommended_action}</div>
          )}
        </div>
      )}

      <div className="case-detail__decision">
        <h3 style={{ marginBottom: 'var(--space-3)' }}>Decision</h3>
        <DecisionPanel
          caseId={c.case_id}
          revision={c.revision}
          reviewStatus={c.review_status}
          onDecision={handleDecision}
        />
      </div>
    </div>
  );
};