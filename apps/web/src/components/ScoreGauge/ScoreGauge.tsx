import { FC } from 'react';

interface ScoreGaugeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showBars?: boolean;
}

/** Big risk score gauge: 0–100 bar + number, coloured by risk level. */
export const ScoreGauge: FC<ScoreGaugeProps> = ({ score, size = 'md', showBars }) => {
  const level = score < 30 ? 'low' : score < 60 ? 'medium' : 'high';
  const colors = { low: 'var(--ok)', medium: 'var(--warn)', high: 'var(--danger)' };
  const width = (score / 100) * 100;

  return (
    <div className="score-gauge" style={{ width: showBars ? `${width}%` : '100%' }}>
      <span className="score-gauge__number" style={{ color: colors[level] }}>
        {score}
      </span>
      {showBars && (
        <div className="score-gauge__bar"
          style={{ backgroundColor: colors[level], width: `${width}%` }}
        />
      )}
    </div>
  );
};