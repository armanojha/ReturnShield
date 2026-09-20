export function MetricCard({
  label,
  value,
  kind = 'neutral',
  detail,
}: {
  label: string;
  value: string | number;
  kind?: 'neutral' | 'ok' | 'warn' | 'danger';
  detail?: string;
}) {
  return (
    <article className={`metric-card metric-card--${kind}`}>
      <div className="metric-card__top">
        <span>{label}</span>
        <span className="metric-icon">↗</span>
      </div>
      <strong>{value}</strong>
      <small>{detail ?? 'Across all synthetic records'}</small>
    </article>
  );
}
