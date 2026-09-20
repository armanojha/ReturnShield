import { FC, useState } from 'react';
import { apiClient } from '../../api/client';
import { Badge } from '../../components/Badge/Badge';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { ErrorState } from '../../components/ErrorState/ErrorState';

/** Customer track return by case ID. */
export const TrackReturn: FC = () => {
  const [caseId, setCaseId] = useState('');
  const [caseData, setCaseData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseId.trim()) return;
    setBusy(true);
    setError(null);
    setCaseData(null);
    try {
      const res = await apiClient.getCase(caseId.trim());
      setCaseData(res.data);
    } catch (err: any) {
      setError(err.message || 'Case not found');
    } finally {
      setBusy(false);
    }
  };

  if (!caseData) {
    return (
      <form onSubmit={handleSubmit} className="track-return" style={{ maxWidth: '400px' }}>
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <label style={{ display: 'block', marginBottom: 'var(--space-1)', fontWeight: 600 }}>Case ID</label>
          <input
            type="text"
            value={caseId}
            onChange={(e) => setCaseId(e.target.value)}
            placeholder="CASE-xxx"
            required
            style={{ width: '100%', padding: 'var(--space-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text)' }}
          />
        </div>
        <button type="submit" disabled={busy} style={{ padding: 'var(--space-2) var(--space-4)', border: 'none', borderRadius: 'var(--radius)', background: 'var(--accent)', color: 'white', fontWeight: 600, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1 }}>
          {busy ? 'Looking up…' : 'Check Status'}
        </button>
        {error && <ErrorState error={error} />}
      </form>
    );
  }

  const c = caseData;
  const isApproved = c.decision === 'AUTO_APPROVE';
  const isDeclined = c.review_status === 'RESOLVED' && c.reviewer_disposition?.action === 'DECLINE_RETURN';

  return (
    <div className="track-return__result" style={{ maxWidth: '500px' }}>
      <h3 style={{ marginBottom: 'var(--space-3)' }}>Return Status</h3>
      <div style={{ padding: 'var(--space-4)', background: 'var(--surface-raised)', borderRadius: 'var(--radius)' }}>
        <p><strong>Case ID:</strong> {c.case_id}</p>
        <p><strong>Status:</strong> <Badge kind={c.status}>{c.status}</Badge></p>
        <p><strong>Decision:</strong> <Badge kind={c.decision}>{c.decision}</Badge></p>
        {isApproved && (
          <div style={{ marginTop: 'var(--space-3)', padding: 'var(--space-3)', background: 'var(--ok-surface)', borderRadius: 'var(--radius)', color: 'var(--ok)' }}>
            <strong>Return Approved</strong>
            <p style={{ marginTop: 'var(--space-1)' }}>Please follow the return instructions provided by the seller.</p>
          </div>
        )}
        {isDeclined && (
          <div style={{ marginTop: 'var(--space-3)', padding: 'var(--space-3)', background: 'var(--danger-surface)', borderRadius: 'var(--radius)', color: 'var(--danger)' }}>
            <strong>Return Declined</strong>
            <p style={{ marginTop: 'var(--space-1)' }}>The return request did not meet the return policy requirements.</p>
          </div>
        )}
        {c.review_status === 'OPEN' && (
          <div style={{ marginTop: 'var(--space-3)', padding: 'var(--space-3)', background: 'var(--warn-surface)', borderRadius: 'var(--radius)', color: 'var(--warn)' }}>
            <strong>Under Review</strong>
            <p style={{ marginTop: 'var(--space-1)' }}>Your return request is under review. We will update you when a decision is available.</p>
          </div>
        )}
      </div>
      <button onClick={() => setCaseData(null)} style={{ marginTop: 'var(--space-3)', padding: 'var(--space-2) var(--space-4)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }}>
        Check Another Case
      </button>
    </div>
  );
};