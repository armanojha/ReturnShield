import type { ReactNode } from 'react';

interface BadgeProps {
  kind?: string | null;
  children?: ReactNode;
}

function normaliseKind(
  value: string,
): string {
  return value
    .trim()
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      '-',
    )
    .replace(
      /^-+|-+$/g,
      '',
    );
}

function formatLabel(
  value: string,
): string {
  return value
    .trim()
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .toLowerCase()
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase(),
    );
}

export function Badge({
  kind,
  children,
}: BadgeProps): JSX.Element {
  const rawValue =
    kind?.trim() ?? '';

  const hasValue =
    rawValue.length > 0;

  const className = hasValue
    ? `badge badge--${normaliseKind(
        rawValue,
      )}`
    : 'badge badge--unknown';

  return (
    <span className={className}>
      <i aria-hidden="true" />

      {children ??
        (hasValue
          ? formatLabel(rawValue)
          : 'Unknown')}
    </span>
  );
}

export default Badge;
