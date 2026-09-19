import { assertValid } from '@returnshield/contracts';
import type { Repositories } from '@returnshield/data';
import { RepositoryConflictError } from '@returnshield/data';
import { evaluateRisk } from '@returnshield/risk-policy';
import { fetchReturnContext } from '@returnshield/context';

import { buildFinalCase } from './case.js';
import { toRiskInput } from './risk.js';
import type { WorkerEvent, WorkflowState } from './types.js';

export async function processWorkflowAction(
  event: WorkerEvent,
  repositories: Repositories,
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
    case 'NeedsReviewEvent':
      return {
        ...state,
        integration: {
          review_event:
            state.case?.decision === 'NEEDS_REVIEW' ? 'PENDING_PHASE_06' : 'NOT_REQUIRED',
          investigation: 'NOT_REQUIRED',
          reviewer_surface: 'READY',
        },
      };
    case 'InvestigationExplanation':
      return {
        ...state,
        integration: {
          review_event: state.integration?.review_event ?? 'NOT_REQUIRED',
          investigation:
            state.case?.decision === 'NEEDS_REVIEW' ? 'PENDING_PHASE_06' : 'NOT_REQUIRED',
          reviewer_surface: 'READY',
        },
      };
    case 'SurfaceToReviewer':
      if (!state.case) throw new Error('Case result is unavailable');
      return state;
  }
}
