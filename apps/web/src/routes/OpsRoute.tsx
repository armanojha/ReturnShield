import { Overview } from '../features/ops/Overview';
import { RiskQueue } from '../features/ops/RiskQueue';
export function OpsRoute() {
  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <span className="eyebrow">Operations overview</span>
          <h1>Trust command center</h1>
          <p>Monitor listing quality, return risk and evidence-backed reviews in real time.</p>
        </div>
        <div className="date-chip">
          <span>●</span> Live ·{' '}
          {new Date().toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </div>
      </div>
      <Overview />
      <RiskQueue />
    </div>
  );
}
export default OpsRoute;
