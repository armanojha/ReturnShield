import { RISK_POLICY } from '../config';
import { LISTING_STATUSES } from '../types';
import type { RiskEvaluationInput, RiskPolicyConfig, SignalEvaluation } from '../types';
import {
  contributionOutcome,
  evidenceRefsFor,
  isOneOf,
  missingContext,
  missingEvidenceFields,
} from './shared';

/**
 * Listing signal (max 25): validated listing.status == CORRECTION_REQUIRED.
 * ListingGuard/AI analysis informs this signal only through the validated `status`;
 * no other AI-derived field is read.
 */
export function evaluateListing(
  input: RiskEvaluationInput,
  policy: RiskPolicyConfig = RISK_POLICY,
): SignalEvaluation {
  const rule = policy.signals.listing;
  const status = input.listing?.status;
  const refs = evidenceRefsFor(input, 'LISTING_CONTENT');

  const missing = [
    ...(isOneOf(LISTING_STATUSES, status) ? [] : ['listing.status']),
    ...missingEvidenceFields('LISTING_CONTENT', refs),
  ];
  if (missing.length > 0 || !isOneOf(LISTING_STATUSES, status)) return missingContext(missing);

  const triggered = status === rule.flagged_status;
  const reason = `Validated listing status=${status}. Rule: ${rule.rule}`;
  return contributionOutcome(policy, 'listing', rule.max, triggered, reason, refs);
}
