import type { CSSProperties } from 'react';

interface ScoreGaugeProps {
  score: number | null;
  size?: 'sm' | 'md' | 'lg';
}

function clampScore(
  score: number,
): number {
  return Math.min(
    100,
    Math.max(0, score),
  );
}

export function ScoreGauge({
  score,
  size = 'md',
}: ScoreGaugeProps): JSX.Element {
  const hasScore =
    typeof score === 'number' &&
    Number.isFinite(score);

  const safeScore = hasScore
    ? clampScore(score)
    : 0;

  const style: CSSProperties & {
    '--score': number;
  } = {
    '--score': safeScore,
  };

  return (
    <div
      className={`score-ring score-ring--${size}${
        hasScore
          ? ''
          : ' score-ring--unavailable'
      }`}
      style={style}
      aria-label={
        hasScore
          ? `Risk score ${safeScore} out of 100`
          : 'Risk score unavailable'
      }
    >
      <div>
        <strong>
          {hasScore
            ? safeScore
            : '—'}
        </strong>

        <span>
          {hasScore
            ? '/ 100'
            : 'score'}
        </span>
      </div>
    </div>
  );
}

export default ScoreGauge;
