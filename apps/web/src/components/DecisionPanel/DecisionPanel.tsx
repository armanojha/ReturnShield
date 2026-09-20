import { FC, PropsWithChildren, useState } from 'react';
import { apiClient } from '../../api/client';

interface DecisionPanelProps {
  caseId: string;
  revision: number;
  reviewStatus: 'OPEN' | 'RESOLVED' | 'NOT_APPLICABLE';
  onDecision?: () => void;
}

/** Decision controls for a case under review. */
export const DecisionPanel: FC<PropsWithChildren<DecisionPanelProps>> = ({
  caseId,
  revision,
  reviewStatus,
  onDecision,
}) => {
  const [action, setAction] = useState<'APPROVE_RETURN' | 'DECLINE_RETURN'>('APPROVE_RETURN');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (reviewStatus !== 'OPEN') {
    return (
      <div className="decision-panel" style={{ padding: 'var(--space-4)', background: 'var(--surface-raised)', borderRadius: 'var(--radius)' }}>
        <div style={{ color: 'var(--text-muted)' }}>
          Review status: {reviewStatus}
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiClient.postDecision(caseId, { action, note, expected_revision: revision });
      onDecision?.();
    } catch (err: any) {
      setError(err.message || 'Decision failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="decision-panel" style={{ padding: 'var(--space-4)', background: 'var(--surface-raised)', borderRadius: 'var(--radius)' }}>
      <h3 style={{ marginBottom: 'var(--space-3)' }}>Reviewer Decision</h3>
      <div style={{ marginBottom: 'var(--space-3)' }}>
        <label style={{ display: 'block', marginBottom: 'var(--space-1)', fontWeight: 600 }}>Action</label>
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
            <input type="radio" name="action" value="APPROVE_RETURN" checked={action === 'APPROVE_RETURN'} onChange={() => setAction('APPROVE_RETURN')} />
            Approve Return
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
            <input type="radio" name="action" value="DECLINE_RETURN" checked={action === 'DECLINE_RETURN'} onChange={() => setAction('DECLINE_RETURN')} />
            Decline Return
          </label>
        </div>
      </div>
      <div style={{ marginBottom: 'var(--space-3)' }}>
        <label style={{ display: 'block', marginBottom: 'var(--space-1)', fontWeight: 600 }}>Note (required)</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          required
          style={{ width: '100%', padding: 'var(--space-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text)', font: 'inherit' }}
        />
      </div>
      {error && <div style={{ color: 'var(--danger)', marginBottom: 'var(--space-2)' }}>{error}</div>}
      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <button type="submit" disabled={busy || !note.trim()} style={{ padding: 'var(--space-2) var(--space-4)', border: 'none', borderRadius: 'var(--radius)', background: action === 'APPROVE_RETURN' ? 'var(--ok)' : 'var(--danger)', color: 'white', fontWeight: 600, cursor: busy ? 'wait' : 'pointer', opacity: busy || !note.trim() ? 0.6 : 1 }}>
          {busy ? 'Submitting…' : `Submit ${action === 'APPROVE_RETURN' ? 'Approve' : 'Decline'}`}
        </button>
      </div>
    </form>
  );
};