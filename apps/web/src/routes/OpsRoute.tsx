import { Page } from '../components/Page';
import { Overview } from '../features/ops/Overview';
import { RiskQueue } from '../features/ops/RiskQueue';

/**
 * `/ops` — the Trust Operations Center.
 */
export function OpsRoute(): JSX.Element {
  return (
    <Page
      eyebrow="Operations"
      title="Trust Operations Center"
      lede="Where reviewers see why a case needs review: contributing signals, evidence, the raw and clamped risk values, and who made the final decision."
    >
      <Overview />
      <RiskQueue />
    </Page>
  );
}

export default OpsRoute;
