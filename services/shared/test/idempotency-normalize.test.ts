import { describe, expect, it } from 'vitest';
import { hashPayload, normalizeForHash, payloadsMatch } from '../src/idempotency/index.js';

describe('idempotency normalization', () => {
  it('sorts object keys recursively and preserves array and string order', () => {
    const first = {
      schema_version: '1.0.0',
      z: ' exact ',
      nested: { b: 2, a: 1 },
      array: ['b', 'a'],
    };
    const second = {
      array: ['b', 'a'],
      nested: { a: 1, b: 2 },
      z: ' exact ',
      schema_version: '1.0.0',
    };
    expect(normalizeForHash(first)).toBe(
      '{"array":["b","a"],"nested":{"a":1,"b":2},"schema_version":"1.0.0","z":" exact "}',
    );
    expect(payloadsMatch(first, second)).toBe(true);
    expect(payloadsMatch(first, { ...second, array: ['a', 'b'] })).toBe(false);
  });
  it('produces a stable SHA-256 digest including schema_version', () => {
    expect(hashPayload({ schema_version: '1.0.0', order_id: 'ORDER-1' })).toMatch(/^[a-f0-9]{64}$/);
    expect(() => hashPayload({ order_id: 'ORDER-1' })).toThrow(/schema_version/);
  });
  it('rejects values that parsed JSON cannot contain', () => {
    expect(() => hashPayload({ schema_version: '1.0.0', value: undefined })).toThrow(/valid JSON/);
    expect(() => hashPayload({ schema_version: '1.0.0', value: Number.NaN })).toThrow(/non-finite/);
  });
});
