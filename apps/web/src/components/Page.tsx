interface PageProps {
  eyebrow: string;
  title: string;
  lede: string;
  children?: React.ReactNode;
}

/** Consistent page heading and body wrapper used by both Phase 01 routes. */
export function Page({ eyebrow, title, lede, children }: PageProps): JSX.Element {
  return (
    <article className="page">
      <p className="page__eyebrow">{eyebrow}</p>
      <h1 className="page__title">{title}</h1>
      <p className="page__lede">{lede}</p>
      {children}
    </article>
  );
}

/** Placeholder for a surface a later phase owns. Never shown as working data. */
export function ComingInPhase({ phase, summary }: { phase: string; summary: string }): JSX.Element {
  return (
    <section className="panel">
      <h2 className="panel__title">Not built yet</h2>
      <p className="panel__body">{summary}</p>
      <p className="panel__meta">Delivered in {phase}.</p>
    </section>
  );
}
