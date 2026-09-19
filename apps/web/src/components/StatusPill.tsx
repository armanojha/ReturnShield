interface StatusPillProps {
  value?: string | null | undefined;
}

function normalize(
  value?: string | null,
): string {
  if (!value) {
    return 'Unknown';
  }

  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase(),
    );
}

export function StatusPill({
  value,
}: StatusPillProps): JSX.Element {
  const normalized =
    value?.toUpperCase() ?? '';

  let tone = 'neutral';

  if (
    normalized === 'AUTO_APPROVE' ||
    normalized === 'PASS' ||
    normalized === 'APPROVED' ||
    normalized === 'APPROVE_RETURN'
  ) {
    tone = 'success';
  }

  if (
    normalized === 'NEEDS_REVIEW' ||
    normalized === 'HIGH'
  ) {
    tone = 'danger';
  }

  if (
    normalized ===
      'CORRECTION_REQUIRED' ||
    normalized === 'MEDIUM' ||
    normalized === 'PENDING'
  ) {
    tone = 'warning';
  }

  return (
    <span
      className={`status-pill status-pill--${tone}`}
    >
      <span className="status-dot" />

      {normalize(value)}
    </span>
  );
}
