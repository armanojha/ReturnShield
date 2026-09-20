import { Overview } from '../features/ops/Overview';
import { RiskQueue } from '../features/ops/RiskQueue';

export function OpsRoute(): JSX.Element {
  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div>
          <span className="eyebrow">
            Operations Center
          </span>

          <h1>
            ReturnShield operations
          </h1>

          <p>
            Review listing quality, return cases, risk
            decisions, evidence, and human-review work
            from the connected ReturnShield services.
          </p>
        </div>
      </header>

      <nav
        aria-label="Operations sections"
        style={{
          display: 'flex',
          gap: 'var(--space-2)',
          flexWrap: 'wrap',
          marginBottom: 'var(--space-4)',
        }}
      >
        <a
          href="#overview"
          className="button-secondary"
        >
          Overview
        </a>

        <a
          href="#queue"
          className="button-secondary"
        >
          Risk queue
        </a>
      </nav>

      <section
        id="overview"
        aria-labelledby="overview-heading"
      >
        <h2
          id="overview-heading"
          className="visually-hidden"
        >
          Operations overview
        </h2>

        <Overview />
      </section>

      <RiskQueue />
    </div>
  );
}

export default OpsRoute;
