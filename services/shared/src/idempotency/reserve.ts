/**
 * Idempotency orchestration (task P2-IDEM-01): the single entry point a
 * Phase 03/05 Lambda calls before performing side effects for a scoped
 * POST route.
 *
 * State machine per key (see `types.ts` for state meanings):
 *
 *   (absent) --putIfAbsent--> IN_PROGRESS --complete--> COMPLETED
 *                                  |
 *                                  +--markFailedRecoverable--> FAILED_RECOVERABLE --resume--> IN_PROGRESS
 *
 * `reserveOrReplay` handles every entry to this state machine:
 *   - absent                                   -> RESERVED (caller does the work, then calls complete/fail)
 *   - existing, different payload hash          -> CONFLICT, regardless of status
 *   - existing, same hash, IN_PROGRESS          -> IN_PROGRESS (an original attempt is still running)
 *   - existing, same hash, COMPLETED            -> COMPLETED (exact replay; caller returns the stored result, never re-runs side effects)
 *   - existing, same hash, FAILED_RECOVERABLE   -> tries to `resume`; RESERVED if this call won the race, IN_PROGRESS if another retrier won it first
 */
import { hashPayload } from './normalize.js';
import type { IdempotencyStoreClient } from './store.js';
import type { IdempotencyRecord, ReservationInput, ReservationOutcome } from './types.js';

export async function reserveOrReplay<TResult = unknown>(
  store: IdempotencyStoreClient,
  input: ReservationInput,
): Promise<ReservationOutcome<TResult>> {
  const payloadHash = hashPayload(input.payload);
  const now = new Date().toISOString();

  const fresh: IdempotencyRecord = {
    pk: input.pk,
    sk: input.sk,
    scope: input.scope,
    payload_hash: payloadHash,
    status: 'IN_PROGRESS',
    logical_id: input.logicalId ?? null,
    result: null,
    created_at: now,
    updated_at: now,
  };

  const putResult = await store.putIfAbsent(fresh);
  if (putResult === 'CREATED') {
    return { kind: 'RESERVED', record: fresh as IdempotencyRecord<TResult> };
  }

  // ALREADY_EXISTS — inspect the existing record.
  const existing = await store.get(input.pk, input.sk);
  if (!existing) {
    // Lost a race between putIfAbsent's ALREADY_EXISTS and this read (e.g.
    // the other writer's record has not yet propagated to a replica read,
    // or — in a real table — this genuinely should not happen on a
    // strongly consistent read). Treat as IN_PROGRESS: safe, and the next
    // retry will see the settled state.
    return {
      kind: 'IN_PROGRESS',
      record: { ...fresh, result: null } as IdempotencyRecord<TResult>,
    };
  }

  if (existing.payload_hash !== payloadHash) {
    return { kind: 'CONFLICT' };
  }

  if (existing.status === 'COMPLETED') {
    return { kind: 'COMPLETED', record: existing as IdempotencyRecord<TResult> };
  }

  if (existing.status === 'IN_PROGRESS') {
    return { kind: 'IN_PROGRESS', record: existing as IdempotencyRecord<TResult> };
  }

  // FAILED_RECOVERABLE — attempt to resume the same logical attempt rather
  // than starting a second one. "At most one committed result" is enforced
  // by `resume`'s conditional update: only one concurrent retrier can win.
  const resumeResult = await store.resume(input.pk, input.sk, payloadHash);
  if (resumeResult === 'RESUMED') {
    const resumed = await store.get(input.pk, input.sk);
    return {
      kind: 'RESERVED',
      record: (resumed ?? { ...existing, status: 'IN_PROGRESS' }) as IdempotencyRecord<TResult>,
    };
  }

  const settled = await store.get(input.pk, input.sk);
  return {
    kind: 'IN_PROGRESS',
    record: (settled ?? existing) as IdempotencyRecord<TResult>,
  };
}

/**
 * Call after side effects for a `RESERVED` outcome succeed. `result` is the
 * durable logical result an exact replay will return (e.g. `{ case }` for
 * return creation, the listing result for analysis, the decided case for a
 * reviewer decision).
 */
export async function completeReservation(
  store: IdempotencyStoreClient,
  input: Pick<ReservationInput, 'pk' | 'sk' | 'payload'>,
  result: unknown,
  logicalId: string | null,
): Promise<'UPDATED' | 'STALE'> {
  const payloadHash = hashPayload(input.payload);
  return store.complete(input.pk, input.sk, payloadHash, result, logicalId);
}

/**
 * Call after side effects for a `RESERVED` outcome fail in a way the caller
 * considers recoverable by retry (transient infrastructure failure, not a
 * business-logic rejection). A caller that decides the failure is terminal
 * and not retryable should NOT call this — per the contract, "POST never
 * creates a replacement," so a genuinely terminal failure is recorded on
 * the logical record itself (e.g. `ReturnCase.status = FAILED`), and the
 * idempotency record should still allow a retry to observe/resume it.
 */
export async function failReservation(
  store: IdempotencyStoreClient,
  input: Pick<ReservationInput, 'pk' | 'sk' | 'payload'>,
): Promise<'UPDATED' | 'STALE'> {
  const payloadHash = hashPayload(input.payload);
  return store.markFailedRecoverable(input.pk, input.sk, payloadHash);
}
