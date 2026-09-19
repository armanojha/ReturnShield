import type { ReturnCase } from '@returnshield/data';

import { InvestigationIntegrityError } from '../errors.js';

/**
 * The evidence allowlist is exactly the set of evidence IDs already attached
 * to the persisted case. Every contribution must cite only allowlisted IDs;
 * anything else means the persisted case cannot ground an explanation.
 */
export function buildEvidenceAllowlist(
  persisted: Pick<ReturnCase, 'evidence' | 'contributions'>,
): string[] {
  const ids = persisted.evidence.map((item) => item.evidence_id);
  const allowed = new Set(ids);
  if (allowed.size !== ids.length)
    throw new InvestigationIntegrityError('Persisted evidence IDs are not unique');
  for (const contribution of persisted.contributions)
    for (const ref of contribution.evidence_refs)
      if (!allowed.has(ref))
        throw new InvestigationIntegrityError(
          'A persisted contribution references evidence that is not attached to the case',
        );
  return ids;
}

/** Evidence IDs that are not on the allowlist. Empty means every reference is supported. */
export function findUnsupportedRefs(
  refs: readonly string[],
  allowed: ReadonlySet<string>,
): string[] {
  return refs.filter((ref) => !allowed.has(ref));
}
