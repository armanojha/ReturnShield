import { describe, expect, it } from 'vitest';

import { errorEnvelope, isApiErrorEnvelope, validateAgainst } from '../src/index.js';

const CORRELATION_ID = '9f8f4c2a-1e0b-4f3d-9c7a-2b1d5e6f7a8b';

describe('Error envelope — accepted', () => {
  it('accepts a minimal internal error with an empty details array', () => {
    const envelope = errorEnvelope(CORRELATION_ID, 'INTERNAL_ERROR', 'Unexpected failure.');
    expect(validateAgainst('Error', envelope).errors).toEqual([]);
    expect(envelope.error.retryable).toBe(false);
    expect(envelope.error.details).toEqual([]);
  });

  it('accepts a retryable error with field details', () => {
    const envelope = errorEnvelope(CORRELATION_ID, 'REQUEST_IN_PROGRESS', 'Already processing.', {
      retryable: true,
      details: [{ field: 'order_id', message: 'A case for this order is already in flight.' }],
    });
    expect(isApiErrorEnvelope(envelope)).toBe(true);
  });

  it('accepts every frozen error code', () => {
    const codes = [
      'VALIDATION_ERROR',
      'NOT_FOUND',
      'IDEMPOTENCY_CONFLICT',
      'REQUEST_IN_PROGRESS',
      'REVISION_CONFLICT',
      'INVALID_STATE',
      'ERROR_MISSING_CONTEXT',
      'AI_UNAVAILABLE',
      'UNAUTHORIZED',
      'FORBIDDEN',
      'RATE_LIMITED',
      'INTERNAL_ERROR',
    ] as const;

    for (const code of codes) {
      expect(isApiErrorEnvelope(errorEnvelope(CORRELATION_ID, code, 'message'))).toBe(true);
    }
  });
});

describe('Error envelope — rejected', () => {
  const base = errorEnvelope(CORRELATION_ID, 'VALIDATION_ERROR', 'Invalid request.');

  const rejections: ReadonlyArray<readonly [string, unknown]> = [
    ['an unknown error code', { ...base, error: { ...base.error, code: 'TEAPOT' } }],
    ['a missing retryable flag', {
      ...base,
      error: { code: 'VALIDATION_ERROR', message: 'x', details: [] },
    }],
    ['a missing details array', {
      ...base,
      error: { code: 'VALIDATION_ERROR', message: 'x', retryable: false },
    }],
    ['an empty message', { ...base, error: { ...base.error, message: '' } }],
    ['a detail entry missing its message', {
      ...base,
      error: { ...base.error, details: [{ field: 'order_id' }] },
    }],
    ['an unknown field inside error', {
      ...base,
      error: { ...base.error, stack: 'Error: at handler' },
    }],
    ['a success payload shaped as data rather than error', {
      schema_version: '1.0.0',
      correlation_id: CORRELATION_ID,
      data: { service: 'returnshield', status: 'ok' },
    }],
    ['an unsupported schema_version', { ...base, schema_version: '0.9.0' }],
  ];

  it.each(rejections)('rejects %s', (_label, payload) => {
    expect(validateAgainst('Error', payload).valid).toBe(false);
  });
});
