import { FC, PropsWithChildren } from 'react';

/** Metric card for the Overview dashboard. */
export const MetricCard: FC<PropsWithChildren<{
  label: string;
  value: string | number;
  kind?: 'neutral' | 'ok' | 'warn' | 'danger';
}>> = ({ label, value, kind = 'neutral', children }) => {
  const colors = {
    neutral: 'var(--text)',
    ok: 'var(--ok)',
    warn: 'var(--warn)',
    danger: 'var(--danger)',
  };

  return (
    <div className="metric-card" style={{ borderLeft: `4px solid ${colors[kind]}` }}>
      <div className="metric-card__label" style={{ color: 'var(--text-muted)' }}>
        {label}
      </div>
      <div className="metric-card__value" style={{ color: colors[kind] }}>
        {value}
      </div>
      {children}
    </div>
  );
};