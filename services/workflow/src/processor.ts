import { assertValid } from '@returnshield/contracts';
import type { Repositories } from '@returnshield/data';
import { RepositoryConflictError } from '@returnshield/data';
import { evaluateRisk } from '@returnshield/risk-policy';
import { fetchReturnContext } from '@returnshield/context';

import { buildFinalCase } from './case.js';
import { awaitsExplanation, buildReviewEvent } from './review-event.js';
import type { ReviewEventPublisher } from './review-event.js';
import { toRiskInput } from './risk.js';
import type { WorkerEvent, WorkflowState } from './types.js';

export async function processWorkflowAction(
  event: WorkerEvent,
  repositories: Repositories,
  publisher?: ReviewEventPublisher,
): Promise<WorkflowState> {
  const state = event.state;
  switch (event.action) {
    case 'ValidateReturn':
      assertValid('ReturnRequest', state.request);
      return state;
    case 'FetchHistory':
      return { ...state, context: await fetchReturnContext(repositories, state.request) };
    case 'CalculateSignals':
      if (!state.context) throw new Error('Return context is unavailable');
      return { ...state, risk_input: toRiskInput(state.context, state.request) };
    case 'CalculateRisk':
      if (!state.risk_input) throw new Error('Risk input is unavailable');
      return { ...state, risk: evaluateRisk(state.risk_input) };
    case 'Decision':
      if (!state.risk) throw new Error('Risk result is unavailable');
      return state;
    case 'CreateOrUpdateCase': {
      const built = buildFinalCase(state);
      try {
        await repositories.cases.createDecision(built.value, built.events);
      } catch (error) {
        if (!(error instanceof RepositoryConflictError)) throw error;
        const existing = await repositories.cases.get(state.case_id);
        if (!existing) throw error;
        return { ...state, case: existing };
      }
      return { ...state, case: built.value };
    }
    case 'NeedsReviewEvent': {
      // One logical RETURN_NEEDS_REVIEW event per review case, emitted only after
      // the deterministic case is committed. The event ID is stable, so a retried
      // emission is deduplicated by the consumer rather than explained twice.
      const detail = state.case ? buildReviewEvent(state.case) : undefined;
      if (detail && state.case && awaitsExplanation(state.case)) {
        if (!publisher) throw new Error('Review event publisher is not configured');
        await publisher.publish(detail);
      }
      return {
        ...state,
        integration: {
          review_event: detail ? 'EMITTED' : 'NOT_REQUIRED',
          investigation: 'NOT_REQUIRED',
          reviewer_surface: 'READY',
        },
      };
    }
    case 'InvestigationExplanation': {
      // The explanation is produced asynchronously by the event consumer. Here the
      // workflow only records the request and re-reads the persisted case so the
      // reviewer surface sees whatever the read model holds right now.
      const persisted = state.case ? await repositories.cases.get(state.case.case_id) : undefined;
      return {
        ...state,
        ...(persisted ? { case: persisted } : {}),
        integration: {
          review_event: state.integration?.review_event ?? 'NOT_REQUIRED',
          investigation: state.case?.decision === 'NEEDS_REVIEW' ? 'REQUESTED' : 'NOT_REQUIRED',
          reviewer_surface: 'READY',
        },
      };
    }
    case 'SurfaceToReviewer':
      if (!state.case) throw new Error('Case result is unavailable');
      return state;
  }
}
