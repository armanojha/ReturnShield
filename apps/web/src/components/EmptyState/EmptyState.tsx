import type { FC, PropsWithChildren } from 'react';

/** Empty state with optional action. */
export const EmptyState: FC<
  PropsWithChildren<{
    title: string;
    message?: string;
    action?: { label: string; onClick: () => void };
  }>
> = ({ title, message, action, children }) => (
  <div className="empty-state" style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
    <h3 style={{ marginBottom: 'var(--space-2)' }}>{title}</h3>
    {message && (
      <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-4)' }}>{message}</p>
    )}
    {action && (
      <button
        onClick={action.onClick}
        style={{
          padding: 'var(--space-2) var(--space-4)',
          border: 'none',
          borderRadius: 'var(--radius)',
          background: 'var(--accent)',
          color: 'white',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        {action.label}
      </button>
    )}
    {children}
  </div>
);
