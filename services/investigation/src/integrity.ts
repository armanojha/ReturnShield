import type { ReturnCase } from '@returnshield/data';

import { InvestigationIntegrityError } from './errors.js';

/**
 * Deterministic case fields the Investigator may never change. `review_status`
 * is listed even though the repository does not guard it, so an explanation
 * write can never alter reviewer workflow either.
 */
export const DETERMINISTIC_FIELDS = [
  'case_id',
  'order_id',
  'seller_id',
  'listing_id',
  'customer_id',
  'reason',
  'evidence',
  'status',
  'raw_contribution_total',
  'risk_score',
  'policy_version',
  'decision',
  'priority',
  'contributions',
  'review_status',
  'reviewer_disposition',
  'error',
  'created_at',
] as const satisfies readonly (keyof ReturnCase)[];

/** Throws unless `after` is identical to `before` in every deterministic field. */
export function assertDeterministicFieldsUnchanged(before: ReturnCase, after: ReturnCase): void {
  for (const field of DETERMINISTIC_FIELDS)
    if (JSON.stringify(before[field]) !== JSON.stringify(after[field]))
      throw new InvestigationIntegrityError(`Explanation write attempted to change ${field}`);
}
