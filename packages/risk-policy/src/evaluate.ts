import { RISK_POLICY } from './config';
import { SIGNAL_EVALUATORS } from './signals';
import type {
  ContractRiskResult,
  MissingContextResult,
  RiskContribution,
  RiskEvaluation,
  RiskEvaluationInput,
  RiskEvaluationOutcome,
  RiskPolicyConfig,
  ScoreBand,
} from './types';

export function isMissingContext(outcome: RiskEvaluationOutcome): outcome is MissingContextResult {
  return 'code' in outcome;
}

/** score = clamp(raw, min, max). Clamping is explicit; the raw total is kept by the caller. */
export function clampScore(raw: number, policy: RiskPolicyConfig = RISK_POLICY): number {
  if (!Number.isInteger(raw)) {
    throw new RangeError(`raw_contribution_total must be an integer, received ${raw}`);
  }
  return Math.min(policy.score_range.max, Math.max(policy.score_range.min, raw));
}

/** Maps a clamped score to its decision/priority band. */
export function classifyScore(score: number, policy: RiskPolicyConfig = RISK_POLICY): ScoreBand {
  const band = policy.bands.find((candidate) => score >= candidate.min && score <= candidate.max);
  if (band === undefined) throw new RangeError(`score ${score} is outside every policy band`);
  return band;
}

/**
 * Composes contributions into the contract result:
 * raw_contribution_total = sum(points); score = clamp(raw); decision/priority from the score.
 * Contribution order is preserved.
 */
export function composeEvaluation(
  contributions: readonly RiskContribution[],
  policy: RiskPolicyConfig = RISK_POLICY,
): RiskEvaluation {
  const copies = contributions.map((item) => ({ ...item, evidence_refs: [...item.evidence_refs] }));
  const raw = copies.reduce((total, item) => total + item.points, 0);
  const score = clampScore(raw, policy);
  const band = classifyScore(score, policy);
  const evidenceRefs = [...new Set(copies.flatMap((item) => item.evidence_refs))];
  return {
    schema_version: policy.schema_version,
    policy_version: policy.policy_version,
    raw_contribution_total: raw,
    score,
    decision: band.decision,
    priority: band.priority,
    contributions: copies,
    evidence_refs: evidenceRefs,
  };
}

/** Strips the package-level `evidence_refs` extension, leaving the strict contract `Result`. */
export function toContractResult(evaluation: RiskEvaluation): ContractRiskResult {
  return {
    schema_version: evaluation.schema_version,
    policy_version: evaluation.policy_version,
    raw_contribution_total: evaluation.raw_contribution_total,
    score: evaluation.score,
    decision: evaluation.decision,
    priority: evaluation.priority,
    contributions: evaluation.contributions.map((item) => ({
      ...item,
      evidence_refs: [...item.evidence_refs],
    })),
  };
}

/**
 * Main deterministic evaluator. Pure: no I/O, clock, randomness or AI. Any missing required
 * context yields ERROR_MISSING_CONTEXT; a missing signal never contributes zero.
 */
export function evaluateRisk(
  input: RiskEvaluationInput | null | undefined,
  policy: RiskPolicyConfig = RISK_POLICY,
): RiskEvaluationOutcome {
  const safeInput: RiskEvaluationInput = input ?? {};
  const contributions: RiskContribution[] = [];
  const missingFields: string[] = [];

  for (const [, evaluate] of SIGNAL_EVALUATORS) {
    const outcome = evaluate(safeInput, policy);
    if (outcome.status === 'OK') contributions.push(outcome.contribution);
    else missingFields.push(...outcome.missing_fields);
  }

  if (missingFields.length > 0) {
    return {
      schema_version: policy.schema_version,
      policy_version: policy.policy_version,
      code: 'ERROR_MISSING_CONTEXT',
      missing_fields: [...new Set(missingFields)],
    };
  }
  return composeEvaluation(contributions, policy);
}
