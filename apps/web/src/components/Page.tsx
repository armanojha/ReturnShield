import type { ReactNode } from 'react';

interface PageProps {
  eyebrow: string;
  title: string;
  lede: string;
  children?: ReactNode;
}

export function Page({
  eyebrow,
  title,
  lede,
  children,
}: PageProps): JSX.Element {
  return (
    <article className="page">
      <p className="page__eyebrow">
        {eyebrow}
      </p>

      <h1 className="page__title">
        {title}
      </h1>

      <p className="page__lede">
        {lede}
      </p>

      {children}
    </article>
  );
}

export default Page;
