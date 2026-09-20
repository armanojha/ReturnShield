export function ScoreGauge({
  score,
  size = 'md',
}: {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showBars?: boolean;
}) {
  const level = score < 30 ? 'low' : score < 60 ? 'medium' : 'high';
  return (
    <div
      className={`score-ring score-ring--${size} score-ring--${level}`}
      style={{ '--score': score } as React.CSSProperties}
    >
      <div>
        <strong>{score}</strong>
        <span>/ 100</span>
      </div>
    </div>
  );
}
