interface SignalBarProps {
  label: string;
  contribution: number;
  max?: number;
}

export function SignalBar({
  label,
  contribution,
  max = 100,
}: SignalBarProps): JSX.Element {
  const percentage =
    max > 0
      ? Math.min(
          100,
          Math.max(
            0,
            (contribution / max) *
              100,
          ),
        )
      : 0;

  return (
    <div className="signal">
      <div className="signal-header">
        <span>
          {label.replace(/_/g, ' ')}
        </span>

        <strong>
          +{contribution}
        </strong>
      </div>

      <div className="signal-track">
        <div
          className="signal-fill"
          style={{
            width: `${percentage}%`,
          }}
        />
      </div>
    </div>
  );
}
