import { RISK_POLICY } from '../config';
import { ORDER_STATUSES, RETURN_REASONS } from '../types';
import type { RiskEvaluationInput, RiskPolicyConfig, SignalEvaluation } from '../types';
import {
  contributionOutcome,
  evidenceRefsFor,
  isOneOf,
  missingContext,
  missingEvidenceFields,
} from './shared';

/** Current-return signal (max 20): request.reason == NOT_RECEIVED AND order.status == DELIVERED. */
export function evaluateReturn(
  input: RiskEvaluationInput,
  policy: RiskPolicyConfig = RISK_POLICY,
): SignalEvaluation {
  const rule = policy.signals.return;
  const reasonValue = input.request?.reason;
  const orderStatus = input.order?.status;
  const refs = evidenceRefsFor(input, 'ORDER_RECORD');

  const missing = [
    ...(isOneOf(RETURN_REASONS, reasonValue) ? [] : ['request.reason']),
    ...(isOneOf(ORDER_STATUSES, orderStatus) ? [] : ['order.status']),
    ...missingEvidenceFields('ORDER_RECORD', refs),
  ];
  if (
    missing.length > 0 ||
    !isOneOf(RETURN_REASONS, reasonValue) ||
    !isOneOf(ORDER_STATUSES, orderStatus)
  ) {
    return missingContext(missing);
  }

  const triggered = reasonValue === rule.reason && orderStatus === rule.order_status;
  const reason = `Order status=${orderStatus}; submitted reason=${reasonValue}. Rule: ${rule.rule}`;
  return contributionOutcome(policy, 'return', rule.max, triggered, reason, refs);
}
