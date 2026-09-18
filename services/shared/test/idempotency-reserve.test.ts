import { describe, expect, it } from 'vitest';
import {
  buildReservationInput,
  completeReservation,
  failReservation,
  reserveOrReplay,
  returnIdempotencyKey,
} from '../src/idempotency/index.js';
import { InMemoryIdempotencyStore } from './support/in-memory-idempotency-store.js';

const payload = {
  schema_version: '1.0.0',
  order_id: 'ORDER-1',
  reason: 'CHANGED_MIND',
  evidence: [],
};
const input = buildReservationInput('RETURN', returnIdempotencyKey('ORDER-1'), payload, 'CASE-1');

describe('idempotency reservation state machine', () => {
  it('has one winner for concurrent reservation attempts', async () => {
    const store = new InMemoryIdempotencyStore();
    const outcomes = await Promise.all([
      reserveOrReplay(store, input),
      reserveOrReplay(store, input),
    ]);
    expect(outcomes.map((value) => value.kind).sort()).toEqual(['IN_PROGRESS', 'RESERVED']);
  });
  it('returns the original result for exact completed replay', async () => {
    const store = new InMemoryIdempotencyStore();
    expect((await reserveOrReplay(store, input)).kind).toBe('RESERVED');
    expect(await completeReservation(store, input, { case_id: 'CASE-1' }, 'CASE-1')).toBe(
      'UPDATED',
    );
    const replay = await reserveOrReplay<{ case_id: string }>(store, input);
    expect(replay.kind).toBe('COMPLETED');
    if (replay.kind === 'COMPLETED') expect(replay.record.result).toEqual({ case_id: 'CASE-1' });
  });
  it('rejects the same order key with a changed payload', async () => {
    const store = new InMemoryIdempotencyStore();
    await reserveOrReplay(store, input);
    const changed = { ...input, payload: { ...payload, reason: 'DAMAGED' } };
    expect((await reserveOrReplay(store, changed)).kind).toBe('CONFLICT');
  });
  it('allows only one retry to resume a recoverable failure', async () => {
    const store = new InMemoryIdempotencyStore();
    await reserveOrReplay(store, input);
    expect(await failReservation(store, input)).toBe('UPDATED');
    const retried = await Promise.all([
      reserveOrReplay(store, input),
      reserveOrReplay(store, input),
    ]);
    expect(retried.map((value) => value.kind).sort()).toEqual(['IN_PROGRESS', 'RESERVED']);
  });
  it('uses order_id as the complete return key', () => {
    expect(returnIdempotencyKey('ORDER-1')).toEqual({
      pk: 'IDEMP#RETURN#ORDER-1',
      sk: 'IDEMP#RETURN#ORDER-1',
    });
  });
});
