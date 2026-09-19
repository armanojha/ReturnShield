import { RISK_POLICY } from '../config';
import type { RiskEvaluationInput, RiskPolicyConfig, SignalEvaluation } from '../types';
import {
  contributionOutcome,
  evidenceRefsFor,
  historyMissingFields,
  isCount,
  isRate,
  missingContext,
  missingEvidenceFields,
} from './shared';

/** Seller signal (max 30): return_rate >= 0.20 OR dispute_count >= 3. */
export function evaluateSeller(
  input: RiskEvaluationInput,
  policy: RiskPolicyConfig = RISK_POLICY,
): SignalEvaluation {
  const rule = policy.signals.seller;
  const returnRate = input.seller?.return_rate;
  const disputeCount = input.seller?.dispute_count;
  const refs = evidenceRefsFor(input, 'SELLER_HISTORY');

  const missing = [
    ...(isRate(returnRate) ? [] : ['seller.return_rate']),
    ...(isCount(disputeCount) ? [] : ['seller.dispute_count']),
    ...historyMissingFields(input),
    ...missingEvidenceFields('SELLER_HISTORY', refs),
  ];
  if (missing.length > 0 || !isRate(returnRate) || !isCount(disputeCount)) {
    return missingContext(missing);
  }

  const triggered =
    returnRate >= rule.return_rate_at_or_above || disputeCount >= rule.dispute_count_at_or_above;
  const reason =
    `Prior ${rule.window_days}-day return_rate=${returnRate}; dispute_count=${disputeCount}; ` +
    `complete synthetic history. Rule: ${rule.rule}`;
  return contributionOutcome(policy, 'seller', rule.max, triggered, reason, refs);
}
