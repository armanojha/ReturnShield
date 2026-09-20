import { FC } from 'react';

interface SignalBarProps {
  signal: 'seller' | 'listing' | 'customer' | 'return' | 'category';
  contribution: number;
  max: number;
  reason: string;
}

/** Horizontal signal bar: contribution / max with reason tooltip. */
export const SignalBar: FC<SignalBarProps> = ({ signal, contribution, max, reason }) => {
  const pct = (contribution / max) * 100;

  return (
    <div className="signal-bar">
      <span className="signal-bar__label">{signal}</span>
      <span className="signal-bar__pct">{pct.toFixed(0)}%</span>
      <span className="signal-bar__tooltip" title={reason}>
        {contribution}/{max}
      </span>
    </div>
  );
};