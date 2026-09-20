import { useState } from 'react';
import type { FC } from 'react';
import { apiClient } from '../../api/client';
import { Badge } from '../../components/Badge/Badge';
import { ErrorState } from '../../components/ErrorState/ErrorState';
import type { ReturnResponse } from '../../api/types';

/** Customer return request form. */
export const ReturnForm: FC = () => {
  const [form, setForm] = useState<{
    order_id: string;
    reason: 'NOT_AS_DESCRIBED' | 'DAMAGED' | 'WRONG_ITEM' | 'NOT_RECEIVED' | 'CHANGED_MIND';
    evidence_text: string;
  }>({
    order_id: '',
    reason: 'CHANGED_MIND',
    evidence_text: '',
  });
  const [result, setResult] = useState<ReturnResponse['data'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reasons = [
    'NOT_AS_DESCRIBED',
    'DAMAGED',
    'WRONG_ITEM',
    'NOT_RECEIVED',
    'CHANGED_MIND',
  ] as const;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const idempotencyKey = crypto.randomUUID();
      const res = await apiClient.createReturn(
        {
          schema_version: '1.0.0',
          order_id: form.order_id,
          reason: form.reason,
          evidence: form.evidence_text
            ? [
                {
                  schema_version: '1.0.0',
                  evidence_id: crypto.randomUUID(),
                  kind: 'RETURN_STATEMENT',
                  source_id: form.order_id,
                  text: form.evidence_text,
                  observed_at: new Date().toISOString(),
                },
              ]
            : [],
        },
        idempotencyKey,
      );
      setResult(res.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit return');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="return-form">
      <form onSubmit={handleSubmit} style={{ maxWidth: '500px' }}>
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <label style={{ display: 'block', marginBottom: 'var(--space-1)', fontWeight: 600 }}>
            Order ID
          </label>
          <input
            type="text"
            value={form.order_id}
            onChange={(e) => setForm({ ...form, order_id: e.target.value })}
            required
            style={{
              width: '100%',
              padding: 'var(--space-2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              background: 'var(--surface)',
              color: 'var(--text)',
            }}
          />
        </div>
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <label style={{ display: 'block', marginBottom: 'var(--space-1)', fontWeight: 600 }}>
            Return Reason
          </label>
          <select
            value={form.reason}
            onChange={(e) =>
              setForm({ ...form, reason: e.target.value as (typeof reasons)[number] })
            }
            style={{
              width: '100%',
              padding: 'var(--space-2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              background: 'var(--surface)',
              color: 'var(--text)',
            }}
          >
            {reasons.map((r) => (
              <option key={r} value={r}>
                {r.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <label style={{ display: 'block', marginBottom: 'var(--space-1)', fontWeight: 600 }}>
            Evidence (optional)
          </label>
          <textarea
            value={form.evidence_text}
            onChange={(e) => setForm({ ...form, evidence_text: e.target.value })}
            rows={3}
            style={{
              width: '100%',
              padding: 'var(--space-2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              background: 'var(--surface)',
              color: 'var(--text)',
            }}
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          style={{
            padding: 'var(--space-2) var(--space-4)',
            border: 'none',
            borderRadius: 'var(--radius)',
            background: 'var(--accent)',
            color: 'white',
            fontWeight: 600,
            cursor: busy ? 'wait' : 'pointer',
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? 'Submitting…' : 'Submit Return Request'}
        </button>
      </form>

      {error && <ErrorState error={error} />}
      {result && (
        <div
          style={{
            marginTop: 'var(--space-4)',
            padding: 'var(--space-4)',
            background: 'var(--surface-raised)',
            borderRadius: 'var(--radius)',
          }}
        >
          <h3 style={{ marginBottom: 'var(--space-2)' }}>Return Request Submitted</h3>
          <p>
            Case ID: <strong>{result.case?.case_id}</strong>
          </p>
          <p>
            Status: <Badge kind={result.case?.status}>{result.case?.status}</Badge>
          </p>
          {result.replayed && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              This request was already submitted (idempotent replay).
            </p>
          )}
        </div>
      )}
    </div>
  );
};
