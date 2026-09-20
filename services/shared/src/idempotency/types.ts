/**
 * Phase 02 (task P2-IDEM-01) — shared idempotency types.
 *
 * Implements the reservation/replay/conflict behavior frozen in
 * `contracts/api/semantics.md` ("POST idempotency") and
 * `Reference/Runtime-Paths-and-Workflow.md` ("Idempotency fix"), for the
 * three scoped POST routes: return creation, listing analysis and reviewer
 * decision. This module only manages the reservation record and its
 * outcome — it never decides HTTP status codes; each Phase 03/05 Lambda
 * maps a `ReservationOutcome` to its own route's status codes because the
 * same underlying states map differently per route (e.g. an in-flight
 * duplicate is 202 for returns but 409 REQUEST_IN_PROGRESS for listing
 * analysis and reviewer decisions).
 */

/**
 * One idempotency record per logical POST-idempotency scope.
 * `IMAGE_UPLOAD`/`IMAGE_COMPLETE` are additive Phase 07A scopes (task
 * P7A-IMG-01) for `POST /v1/images/uploads` and
 * `POST /v1/images/{image_id}/complete`, following the same frozen
 * "one idempotency key per scoped POST route" rule as the others.
 */
export type IdempotencyScope =
  | 'RETURN'
  | 'LISTING_ANALYZE'
  | 'CASE_DECISION'
  | 'IMAGE_UPLOAD'
  | 'IMAGE_COMPLETE';

/**
 * `IN_PROGRESS` — reservation is held, side effects have not (yet) committed.
 * `COMPLETED` — side effects committed; `result` holds the durable logical result.
 * `FAILED_RECOVERABLE` — the original attempt failed after reserving the key;
 *   a retry with the same key and payload may resume it (see `reserveOrReplay`).
 */
export type IdempotencyStatus = 'IN_PROGRESS' | 'COMPLETED' | 'FAILED_RECOVERABLE';

export interface IdempotencyRecord<TResult = unknown> {
  pk: string;
  sk: string;
  scope: IdempotencyScope;
  /** SHA-256 hex digest of the normalized request payload. */
  payload_hash: string;
  status: IdempotencyStatus;
  /**
   * The id of the record this reservation ultimately produced or refers to
   * (e.g. `case_id`, `listing_id`). Present once known; a fresh `IN_PROGRESS`
   * reservation for return creation carries it from the start (the case_id
   * is minted before the workflow starts), but for listing analysis it is
   * only known once analysis completes.
   */
  logical_id: string | null;
  /** Present only when `status === 'COMPLETED'`. */
  result: TResult | null;
  created_at: string;
  updated_at: string;
}

/**
 * Outcome of attempting to reserve (or replay) an idempotency key. The
 * caller (a Phase 03/05 Lambda) maps this to its own route's status codes.
 */
export type ReservationOutcome<TResult = unknown> =
  | { kind: 'RESERVED'; record: IdempotencyRecord<TResult> }
  | { kind: 'IN_PROGRESS'; record: IdempotencyRecord<TResult> }
  | { kind: 'COMPLETED'; record: IdempotencyRecord<TResult> }
  | { kind: 'CONFLICT' };

export interface ReservationInput {
  scope: IdempotencyScope;
  pk: string;
  sk: string;
  /** Full request body, including `schema_version` — see `normalize.ts`. */
  payload: unknown;
  /** Known at reservation time for return creation; `null` otherwise. */
  logicalId?: string | null;
}
