import { RISK_POLICY } from '../config';
import { LISTING_CATEGORIES } from '../types';
import type { RiskEvaluationInput, RiskPolicyConfig, SignalEvaluation } from '../types';
import {
  contributionOutcome,
  evidenceRefsFor,
  isOneOf,
  missingContext,
  missingEvidenceFields,
} from './shared';

/** Category signal (max 15): listing.category == ELECTRONICS. */
export function evaluateCategory(
  input: RiskEvaluationInput,
  policy: RiskPolicyConfig = RISK_POLICY,
): SignalEvaluation {
  const rule = policy.signals.category;
  const category = input.listing?.category;
  const refs = evidenceRefsFor(input, 'CATEGORY_POLICY');

  const missing = [
    ...(isOneOf(LISTING_CATEGORIES, category) ? [] : ['listing.category']),
    ...missingEvidenceFields('CATEGORY_POLICY', refs),
  ];
  if (missing.length > 0 || !isOneOf(LISTING_CATEGORIES, category)) return missingContext(missing);

  const triggered = category === rule.flagged_category;
  const reason =
    `Listing category=${category}; policy ${policy.policy_version} adds ${rule.max} ` +
    `only for ${rule.flagged_category}. Rule: ${rule.rule}`;
  return contributionOutcome(policy, 'category', rule.max, triggered, reason, refs);
}
