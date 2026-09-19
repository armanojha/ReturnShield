import { RISK_POLICY } from '../config';
import type { RiskEvaluationInput, RiskPolicyConfig, SignalEvaluation } from '../types';
import {
  contributionOutcome,
  evidenceRefsFor,
  historyMissingFields,
  isCount,
  missingContext,
  missingEvidenceFields,
} from './shared';

/** Customer signal (max 20): recent_returns >= 3. */
export function evaluateCustomer(
  input: RiskEvaluationInput,
  policy: RiskPolicyConfig = RISK_POLICY,
): SignalEvaluation {
  const rule = policy.signals.customer;
  const recentReturns = input.customer?.recent_returns;
  const refs = evidenceRefsFor(input, 'CUSTOMER_HISTORY');

  const missing = [
    ...(isCount(recentReturns) ? [] : ['customer.recent_returns']),
    ...historyMissingFields(input),
    ...missingEvidenceFields('CUSTOMER_HISTORY', refs),
  ];
  if (missing.length > 0 || !isCount(recentReturns)) return missingContext(missing);

  const triggered = recentReturns >= rule.recent_returns_at_or_above;
  const reason =
    `Prior ${rule.window_days}-day recent_returns=${recentReturns}; ` +
    `complete synthetic history. Rule: ${rule.rule}`;
  return contributionOutcome(policy, 'customer', rule.max, triggered, reason, refs);
}
