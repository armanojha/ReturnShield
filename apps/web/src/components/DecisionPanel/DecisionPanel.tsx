import { useState } from 'react';
import { apiClient } from '../../api/client';
import type { ReturnCase } from '../../api/types';
export function DecisionPanel({
  value,
  onDecision,
}: {
  value: ReturnCase;
  onDecision: (next: ReturnCase) => void;
}) {
  const [action, setAction] = useState<'APPROVE_RETURN' | 'DECLINE_RETURN'>('APPROVE_RETURN'),
    [note, setNote] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  if (value.review_status !== 'OPEN')
    return (
      <div className="decision-complete">
        <span>✓</span>
        <div>
          <strong>Review resolved</strong>
          <p>
            {String(
              value.reviewer_disposition?.note ?? 'A reviewer disposition has been recorded.',
            )}
          </p>
        </div>
      </div>
    );
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await apiClient.postDecision(value.case_id, {
        action,
        note,
        expected_revision: value.revision,
      });
      onDecision(r.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Decision failed.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="decision-panel" onSubmit={submit}>
      <div className="decision-options">
        <button
          type="button"
          onClick={() => setAction('APPROVE_RETURN')}
          className={action === 'APPROVE_RETURN' ? 'selected approve' : ''}
        >
          <span>✓</span>
          <div>
            <strong>Approve return</strong>
            <small>Continue the return process</small>
          </div>
        </button>
        <button
          type="button"
          onClick={() => setAction('DECLINE_RETURN')}
          className={action === 'DECLINE_RETURN' ? 'selected decline' : ''}
        >
          <span>×</span>
          <div>
            <strong>Decline return</strong>
            <small>Reject with analyst rationale</small>
          </div>
        </button>
      </div>
      <label>
        Decision note
        <textarea
          required
          minLength={1}
          maxLength={4000}
          rows={4}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Document the evidence and rationale behind this decision…"
        />
      </label>
      {error && <p className="form-error">{error}</p>}
      <button className="button-primary" disabled={busy || !note.trim()}>
        {busy ? 'Saving decision…' : 'Confirm reviewer decision'}
      </button>
    </form>
  );
}
