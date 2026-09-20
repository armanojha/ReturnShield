import { FC } from 'react';

interface BadgeProps {
  kind: 'PASS' | 'AUTO_APPROVE' | 'CORRECTION_REQUIRED' | 'NEEDS_REVIEW' | 'HIGH' | 'OPEN' | 'RESOLVED' | 'PROCESSING';
  size?: 'sm' | 'md' | 'lg';
  children?: React.ReactNode;
}

/** Small status/pill badge with risk-coloured background. */
export const Badge: FC<BadgeProps> = ({ kind, size = 'md', children }) => {
  const variants = {
    PASS: 'var(--ok)',
    AUTO_APPROVE: 'var(--ok)',
    CORRECTION_REQUIRED: 'var(--warn)',
    NEEDS_REVIEW: 'var(--warn)',
    HIGH: 'var(--danger)',
    OPEN: 'var(--text)',
    RESOLVED: 'var(--text-muted)',
    PROCESSING: 'var(--text-muted)',
  };

  const sizes = {
    sm: 'var(--space-1)',
    md: 'var(--space-2)',
    lg: 'var(--space-3)',
  };

  return (
    <span
      className="badge"
      style={{
        backgroundColor: variants[kind],
        color: 'white',
        fontSize: size === 'sm' ? '0.75rem' : size === 'md' ? '0.875rem' : '1rem',
        padding: sizes[size],
        borderRadius: 999,
        whiteSpace: 'nowrap',
      }}
    >
      {children !== undefined ? children : kind}
    </span>
  );
};