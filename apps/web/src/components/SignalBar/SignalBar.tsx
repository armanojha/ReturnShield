interface SignalBarProps {
  signal: string;
  contribution: number | null;
  max: number | null;
  reason: string;
}

function formatNumber(
  value: number,
): string {
  if (!Number.isFinite(value)) {
    return '—';
  }

  return new Intl.NumberFormat(
    undefined,
    {
      maximumFractionDigits: 2,
    },
  ).format(value);
}

function formatContribution(
  value: number | null,
): string {
  if (
    value === null ||
    !Number.isFinite(value)
  ) {
    return 'Unavailable';
  }

  const sign =
    value > 0
      ? '+'
      : '';

  return `${sign}${formatNumber(value)}`;
}

function getPercentage(
  contribution: number | null,
  max: number | null,
): number | null {
  if (
    contribution === null ||
    max === null ||
    !Number.isFinite(
      contribution,
    ) ||
    !Number.isFinite(max) ||
    max <= 0
  ) {
    return null;
  }

  return Math.min(
    100,
    Math.max(
      0,
      (contribution / max) * 100,
    ),
  );
}

export function SignalBar({
  signal,
  contribution,
  max,
  reason,
}: SignalBarProps): JSX.Element {
  const percentage =
    getPercentage(
      contribution,
      max,
    );

  const hasNumericContribution =
    contribution !== null &&
    Number.isFinite(
      contribution,
    );

  const hasNumericMaximum =
    max !== null &&
    Number.isFinite(max);

  return (
    <div className="signal-row">
      <div className="signal-row__head">
        <strong>
          {signal}
        </strong>

        <span>
          {formatContribution(
            contribution,
          )}

          {' / '}

          {hasNumericMaximum
            ? formatNumber(max)
            : 'Unavailable'}
        </span>
      </div>

      <div
        className="signal-track"
        role="progressbar"
        aria-label={`${signal} risk contribution`}
        aria-valuemin={0}
        aria-valuemax={
          hasNumericMaximum &&
          max !== null &&
          max > 0
            ? max
            : 100
        }
        aria-valuenow={
          percentage !== null
            ? percentage
            : undefined
        }
        aria-valuetext={
          percentage !== null
            ? `${Math.round(
                percentage,
              )}%`
            : 'Contribution unavailable'
        }
      >
        {percentage !== null && (
          <i
            style={{
              width: `${percentage}%`,
            }}
          />
        )}
      </div>

      <p>
        {reason || (
          hasNumericContribution
            ? 'No additional explanation was provided.'
            : 'Contribution details are unavailable.'
        )}
      </p>
    </div>
  );
}

export default SignalBar;
