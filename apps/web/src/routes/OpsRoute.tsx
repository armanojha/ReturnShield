import { ComingInPhase, Page } from '../components/Page';

/**
 * `/ops` — the Trust Operations Center shell.
 *
 * Phase 01 delivers the shell and a live health check only. The dashboard,
 * risk queue and case investigation view belong to Phase 07.
 */
export function OpsRoute(): JSX.Element {
  return (
    <Page
      eyebrow="Operations"
      title="Trust Operations Center"
      lede="Where reviewers see why a case needs review: contributing signals, evidence, the raw and clamped risk values, and who made the final decision."
    >
      <ComingInPhase
        phase="Phase 07"
        summary="Overview counts, the risk queue and the case investigation view with contributions, evidence and timeline."
      />
      <ComingInPhase
        phase="Phase 06"
        summary="The evidence-grounded Investigator explanation attached to a case under review."
      />
    </Page>
  );
}

export default OpsRoute;
