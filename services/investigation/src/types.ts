import type { Evidence } from '@returnshield/data';

/** Signals the frozen policy can attribute a contribution to. */
export type PolicySignal = 'seller' | 'listing' | 'customer' | 'return' | 'category';

export interface PolicyContribution {
  schema_version: '1.0.0';
  signal: PolicySignal;
  points: number;
  max: number;
  reason: string;
  evidence_refs: string[];
}

/** Mirrors `risk/evaluation.schema.json#/$defs/Result`. */
export interface PolicyResult {
  schema_version: '1.0.0';
  policy_version: '1.0.0';
  raw_contribution_total: number;
  score: number;
  decision: 'AUTO_APPROVE' | 'NEEDS_REVIEW';
  priority: 'NONE' | 'NORMAL' | 'HIGH';
  contributions: PolicyContribution[];
}

/** Mirrors `ai/models.schema.json#/$defs/InvestigatorInput`. */
export interface InvestigatorInput {
  schema_version: '1.0.0';
  case_id: string;
  policy_result: PolicyResult;
  evidence: Evidence[];
  allowed_evidence_ids: string[];
}

export interface InvestigatorFactor {
  signal: PolicySignal;
  explanation: string;
  evidence_refs: string[];
}

/** Mirrors `ai/models.schema.json#/$defs/InvestigatorOutput`. */
export interface InvestigatorOutput {
  schema_version: '1.0.0';
  summary: string;
  factors: InvestigatorFactor[];
  recommended_action: 'HUMAN_REVIEW';
}

/** Mirrors `ai/models.schema.json#/$defs/ReviewEvent`. */
export interface ReviewEventDetail {
  schema_version: '1.0.0';
  event_type: 'RETURN_NEEDS_REVIEW';
  event_id: string;
  case_id: string;
  order_id: string;
  seller_id: string;
  listing_id: string;
  policy_version: '1.0.0';
  risk_score: number;
  priority: 'NORMAL' | 'HIGH';
  occurred_at: string;
}

export type InvestigationOutcome =
  | 'EXPLAINED'
  | 'DUPLICATE_IGNORED'
  | 'RETRY_PENDING'
  | 'UNAVAILABLE'
  | 'NOT_ELIGIBLE';

export interface InvestigationResult {
  outcome: InvestigationOutcome;
  case_id: string;
}
