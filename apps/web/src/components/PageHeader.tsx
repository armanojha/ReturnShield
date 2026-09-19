interface PageHeaderProps {
  eyebrow: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: PageHeaderProps): JSX.Element {
  return (
    <div className="page-header">
      <div>
        <div className="eyebrow">
          {eyebrow}
        </div>

        <h1>{title}</h1>

        {description && (
          <p>{description}</p>
        )}
      </div>

      {action && (
        <div className="page-header-action">
          {action}
        </div>
      )}
    </div>
  );
}
