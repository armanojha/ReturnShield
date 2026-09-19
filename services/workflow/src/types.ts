import type { ReturnContext, ReturnRequestInput } from '@returnshield/context';
import type { ReturnCase, Repositories } from '@returnshield/data';
import type { RiskEvaluationInput, RiskEvaluationOutcome } from '@returnshield/risk-policy';

export const WORKFLOW_ACTIONS = [
  'ValidateReturn',
  'FetchHistory',
  'CalculateSignals',
  'CalculateRisk',
  'Decision',
  'CreateOrUpdateCase',
  'NeedsReviewEvent',
  'InvestigationExplanation',
  'SurfaceToReviewer',
] as const;
export type WorkflowAction = (typeof WORKFLOW_ACTIONS)[number];

export interface WorkflowState {
  schema_version: '1.0.0';
  correlation_id: string;
  case_id: string;
  request: ReturnRequestInput;
  context?: ReturnContext;
  risk_input?: RiskEvaluationInput;
  risk?: RiskEvaluationOutcome;
  case?: ReturnCase;
  integration?: {
    review_event: 'NOT_REQUIRED' | 'EMITTED';
    investigation: 'NOT_REQUIRED' | 'REQUESTED';
    reviewer_surface: 'READY';
  };
}

export interface WorkerEvent {
  action: WorkflowAction;
  state: WorkflowState;
}
export type RepositoryProvider = Repositories;
