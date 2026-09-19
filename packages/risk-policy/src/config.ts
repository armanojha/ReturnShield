import type { PolicyVersion, RiskPolicyConfig, SchemaVersion } from './types';

export const SCHEMA_VERSION: SchemaVersion = '1.0.0';
export const POLICY_VERSION: PolicyVersion = '1.0.0';

function deepFreeze<T extends object>(value: T): T {
  for (const child of Object.values(value)) {
    if (child !== null && typeof child === 'object') deepFreeze(child);
  }
  return Object.freeze(value);
}

/**
 * Policy 1.0.0. Every threshold, maximum and score band lives here and nowhere else.
 * Values mirror contracts/risk/policy.json; tests assert parity with that frozen file.
 */
export const RISK_POLICY: RiskPolicyConfig = deepFreeze<RiskPolicyConfig>({
  schema_version: SCHEMA_VERSION,
  policy_version: POLICY_VERSION,
  score_range: { min: 0, max: 100 },
  signals: {
    seller: {
      max: 30,
      window_days: 90,
      return_rate_at_or_above: 0.2,
      dispute_count_at_or_above: 3,
      rule: 'seller.return_rate >= 0.20 OR seller.dispute_count >= 3',
    },
    listing: {
      max: 25,
      flagged_status: 'CORRECTION_REQUIRED',
      rule: 'listing.status == CORRECTION_REQUIRED',
    },
    customer: {
      max: 20,
      window_days: 30,
      recent_returns_at_or_above: 3,
      rule: 'customer.recent_returns >= 3',
    },
    return: {
      max: 20,
      reason: 'NOT_RECEIVED',
      order_status: 'DELIVERED',
      rule: 'request.reason == NOT_RECEIVED AND order.status == DELIVERED',
    },
    category: {
      max: 15,
      flagged_category: 'ELECTRONICS',
      rule: 'listing.category == ELECTRONICS',
    },
  },
  bands: [
    { min: 0, max: 29, decision: 'AUTO_APPROVE', priority: 'NONE' },
    { min: 30, max: 59, decision: 'NEEDS_REVIEW', priority: 'NORMAL' },
    { min: 60, max: 100, decision: 'NEEDS_REVIEW', priority: 'HIGH' },
  ],
});
