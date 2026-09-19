interface MetricCardProps {
  label: string;
  value: unknown;
}

export function MetricCard({
  label,
  value,
}: MetricCardProps): JSX.Element {
  return (
    <div className="metric-card">
      <div className="metric-label">
        {label}
      </div>

      <div className="metric-value">
        {formatMetricValue(value)}
      </div>
    </div>
  );
}

function formatMetricValue(
  value: unknown,
): string {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return '—';
  }

  if (
    typeof value === 'number' ||
    typeof value === 'string'
  ) {
    return String(value);
  }

  return JSON.stringify(value);
}
