export function SignalBar({
  signal,
  contribution,
  max,
  reason,
}: {
  signal: string;
  contribution: number | null;
  max: number | null;
  reason: string;
}) {
  const pct = max && contribution !== null ? Math.round((contribution / max) * 100) : 0;
  return (
    <div className="signal-row">
      <div className="signal-row__head">
        <strong>{signal}</strong>
        <span>
          +{contribution ?? 0} / {max ?? 0}
        </span>
      </div>
      <div className="signal-track">
        <i style={{ width: `${pct}%` }} />
      </div>
      <p>{reason}</p>
    </div>
  );
}
