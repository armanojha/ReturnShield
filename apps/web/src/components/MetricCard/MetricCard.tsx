interface MetricCardProps {
  label: string;
  value: string | number;
  kind?: 'neutral' | 'ok' | 'warn' | 'danger';
  detail?: string;
}

export function MetricCard({
  label,
  value,
  kind = 'neutral',
  detail,
}: MetricCardProps): JSX.Element {
  return (
    <article
      className={`metric-card metric-card--${kind}`}
    >
      <div className="metric-card__top">
        <span>{label}</span>

        <span
          className="metric-icon"
          aria-hidden="true"
        >
          ↗
        </span>
      </div>

      <strong>
        {value}
      </strong>

      {detail && (
        <small>
          {detail}
        </small>
      )}
    </article>
  );
}
