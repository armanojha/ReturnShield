import type { FC, PropsWithChildren } from 'react';

interface TimelineEvent {
  event_id: string;
  case_id: string;
  timestamp: string;
  type:
    | 'RETURN_RECEIVED'
    | 'POLICY_DECIDED'
    | 'REVIEW_REQUESTED'
    | 'EXPLANATION_AVAILABLE'
    | 'REVIEWER_DECISION';
  actor_id: string;
  message: string;
}

/** Vertical timeline of case events. */
export const Timeline: FC<
  PropsWithChildren<{
    events: TimelineEvent[];
  }>
> = ({ events }) => {
  const typeLabels: Record<string, string> = {
    RETURN_RECEIVED: 'Return Received',
    POLICY_DECIDED: 'Policy Decided',
    REVIEW_REQUESTED: 'Review Requested',
    EXPLANATION_AVAILABLE: 'Explanation Available',
    REVIEWER_DECISION: 'Reviewer Decision',
  };

  const typeColors: Record<string, string> = {
    RETURN_RECEIVED: 'var(--text)',
    POLICY_DECIDED: 'var(--warn)',
    REVIEW_REQUESTED: 'var(--danger)',
    EXPLANATION_AVAILABLE: 'var(--ok)',
    REVIEWER_DECISION: 'var(--accent)',
  };

  return (
    <div className="timeline">
      {events.map((event) => (
        <div
          key={event.event_id}
          className="timeline__item"
          style={{
            position: 'relative',
            paddingLeft: 'var(--space-6)',
            marginBottom: 'var(--space-4)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: typeColors[event.type] || 'var(--text)',
              border: '2px solid var(--surface)',
            }}
          />
          <div style={{ borderLeft: '2px solid var(--border)', paddingLeft: 'var(--space-3)' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 'var(--space-1)',
              }}
            >
              <span style={{ fontWeight: 600, color: typeColors[event.type] || 'var(--text)' }}>
                {typeLabels[event.type] || event.type}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {new Date(event.timestamp).toLocaleString()}
              </span>
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              {event.message} <span style={{ color: 'var(--text)' }}>— {event.actor_id}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
