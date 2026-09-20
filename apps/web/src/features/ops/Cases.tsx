import { RiskQueue } from './RiskQueue';

export function Cases(): JSX.Element {
  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div>
          <span className="eyebrow">
            Operations Center
          </span>
          <h1>Return cases</h1>
          <p>
            Explore, filter, and inspect all return cases evaluated by ReturnShield.
          </p>
        </div>
      </header>
      <RiskQueue />
    </div>
  );
}

export default Cases;
