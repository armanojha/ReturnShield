import { describe, expect, it } from 'vitest';

import {
  ContractViolationError,
  assertValid,
  healthEnvelope,
  isHealthResponse,
  validateAgainst,
} from '../src/index.js';
import type { HealthResponse } from '../src/index.js';

const VALID_CORRELATION_ID = '9f8f4c2a-1e0b-4f3d-9c7a-2b1d5e6f7a8b';

function valid(): HealthResponse {
  return healthEnvelope(VALID_CORRELATION_ID);
}

describe('HealthResponse — accepted envelopes', () => {
  it('accepts the envelope produced by the shared builder', () => {
    const result = validateAgainst<HealthResponse>('HealthResponse', valid());
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('produces exactly the frozen fields and no others', () => {
    const envelope = valid();
    expect(Object.keys(envelope).sort()).toEqual(['correlation_id', 'data', 'schema_version']);
    expect(Object.keys(envelope.data).sort()).toEqual(['service', 'status']);
    expect(envelope.schema_version).toBe('1.0.0');
    expect(envelope.data).toEqual({ service: 'returnshield', status: 'ok' });
  });

  it('accepts a short correlation id at the lower bound of the frozen pattern', () => {
    expect(isHealthResponse({ ...valid(), correlation_id: 'a' })).toBe(true);
  });

  it('accepts a correlation id at the 80 character upper bound', () => {
    expect(isHealthResponse({ ...valid(), correlation_id: 'a'.repeat(80) })).toBe(true);
  });
});

describe('HealthResponse — rejected envelopes', () => {
  const rejections: ReadonlyArray<readonly [string, unknown]> = [
    ['an unsupported schema_version', { ...valid(), schema_version: '1.1.0' }],
    ['a missing schema_version', { correlation_id: VALID_CORRELATION_ID, data: valid().data }],
    ['a missing correlation_id', { schema_version: '1.0.0', data: valid().data }],
    ['a correlation_id with a leading separator', { ...valid(), correlation_id: '-abc' }],
    ['a correlation_id longer than 80 characters', { ...valid(), correlation_id: 'a'.repeat(81) }],
    ['an empty correlation_id', { ...valid(), correlation_id: '' }],
    ['an unknown top-level field', { ...valid(), extra: true }],
    ['an unknown field inside data', { ...valid(), data: { ...valid().data, region: 'us-east-1' } }],
    ['a wrong service name', { ...valid(), data: { service: 'other', status: 'ok' } }],
    ['a degraded status that the frozen schema does not allow', {
      ...valid(),
      data: { service: 'returnshield', status: 'degraded' },
    }],
    ['a missing data object', { schema_version: '1.0.0', correlation_id: VALID_CORRELATION_ID }],
    ['a null data object', { ...valid(), data: null }],
    ['a non-object payload', 'ok'],
    ['an empty object', {}],
  ];

  it.each(rejections)('rejects %s', (_label, payload) => {
    const result = validateAgainst('HealthResponse', payload);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('throws ContractViolationError with the definition name attached', () => {
    expect(() => assertValid('HealthResponse', { ...valid(), schema_version: '2.0.0' })).toThrow(
      ContractViolationError,
    );

    try {
      assertValid('HealthResponse', {});
    } catch (error) {
      expect(error).toBeInstanceOf(ContractViolationError);
      expect((error as ContractViolationError).definition).toBe('HealthResponse');
      expect((error as ContractViolationError).violations.length).toBeGreaterThan(0);
    }
  });
});
