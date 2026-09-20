export function Badge({ kind, children }: { kind?: string | null; children?: React.ReactNode }) {
  const value = kind ?? 'UNKNOWN';
  return (
    <span className={`badge badge--${value.toLowerCase().replaceAll('_', '-')}`}>
      <i />
      {children ?? value.replaceAll('_', ' ')}
    </span>
  );
}
