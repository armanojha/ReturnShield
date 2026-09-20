/**
 * Scoped idempotency key builders (task P2-IDEM-01), matching
 * `contracts/api/semantics.md`:
 *
 * - Returns: `order_id` is the ONLY idempotency key — never a second key.
 * - Listing analysis: caller-supplied `Idempotency-Key` header, scoped to
 *   the `POST /listings/analyze` route.
 * - Reviewer decision: caller-supplied `Idempotency-Key` header, scoped to
 *   `case_id` + the `POST /cases/{case_id}/decision` route.
 *
 * These prefixes must stay in sync with `IDEMPOTENCY` in
 * `infra/data/table-schema.ts` (both use `IDEMP#` as the top-level prefix).
 */
import type { IdempotencyScope, ReservationInput } from './types.js';

export interface KeyPair {
  pk: string;
  sk: string;
}

export function returnIdempotencyKey(orderId: string): KeyPair {
  const key = `IDEMP#RETURN#${orderId}`;
  return { pk: key, sk: key };
}

export function listingAnalyzeIdempotencyKey(idempotencyKey: string): KeyPair {
  const key = `IDEMP#LISTING_ANALYZE#${idempotencyKey}`;
  return { pk: key, sk: key };
}

export function caseDecisionIdempotencyKey(caseId: string, idempotencyKey: string): KeyPair {
  const key = `IDEMP#CASE_DECISION#${caseId}#${idempotencyKey}`;
  return { pk: key, sk: key };
}

/** Phase 07A additive keys (task P7A-IMG-01). */
export function imageUploadIdempotencyKey(idempotencyKey: string): KeyPair {
  const key = `IDEMP#IMAGE_UPLOAD#${idempotencyKey}`;
  return { pk: key, sk: key };
}

export function imageCompleteIdempotencyKey(imageId: string, idempotencyKey: string): KeyPair {
  const key = `IDEMP#IMAGE_COMPLETE#${imageId}#${idempotencyKey}`;
  return { pk: key, sk: key };
}

/** Phase 07B partner-context synchronization key. */
export function partnerContextIdempotencyKey(idempotencyKey: string): KeyPair {
  const key = `IDEMP#PARTNER_CONTEXT#${idempotencyKey}`;
  return { pk: key, sk: key };
}

export function buildReservationInput(
  scope: IdempotencyScope,
  keys: KeyPair,
  payload: unknown,
  logicalId?: string | null,
): ReservationInput {
  return { scope, pk: keys.pk, sk: keys.sk, payload, logicalId: logicalId ?? null };
}
