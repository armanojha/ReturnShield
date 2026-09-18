import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ID_PATTERN, validateAgainst } from '@returnshield/contracts';

import { handler } from '../src/handler.js';

const CALLER_CORRELATION_ID = 'abc123-caller_id';

function parse(body: string): unknown {
  return JSON.parse(body) as unknown;
}

function captureLogs() {
  const lines: Record<string, unknown>[] = [];
  const record = (value: unknown) => {
    if (typeof value === 'string') lines.push(JSON.parse(value) as Record<string, unknown>);
  };
  vi.spyOn(console, 'log').mockImplementation(record);
  vi.spyOn(console, 'warn').mockImplementation(record);
  vi.spyOn(console, 'error').mockImplementation(record);
  return lines;
}

describe('GET /v1/health', () => {
  beforeEach(() => {
    captureLogs();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 200 with a body that satisfies the frozen HealthResponse schema', async () => {
    const result = await handler({});

    expect(result.statusCode).toBe(200);
    expect(validateAgainst('HealthResponse', parse(result.body)).errors).toEqual([]);
  });

  it('returns exactly the frozen fields and no diagnostic extras', async () => {
    const body = parse((await handler({})).body) as Record<string, unknown>;

    expect(Object.keys(body).sort()).toEqual(['correlation_id', 'data', 'schema_version']);
    expect(body['schema_version']).toBe('1.0.0');
    expect(body['data']).toEqual({ service: 'returnshield', status: 'ok' });
  });

  it('declares a JSON content type and disables caching', async () => {
    const headers = (await handler({})).headers as Record<string, string>;

    expect(headers['content-type']).toBe('application/json');
    expect(headers['cache-control']).toBe('no-store');
  });

  it('generates a correlation id that matches the frozen ID pattern', async () => {
    const body = parse((await handler({})).body) as { correlation_id: string };

    expect(body.correlation_id).toMatch(ID_PATTERN);
  });

  it('echoes a caller-supplied correlation id in the body and the header', async () => {
    const result = await handler({ headers: { 'X-Correlation-Id': CALLER_CORRELATION_ID } });
    const body = parse(result.body) as { correlation_id: string };
    const headers = result.headers as Record<string, string>;

    expect(body.correlation_id).toBe(CALLER_CORRELATION_ID);
    expect(headers['x-correlation-id']).toBe(CALLER_CORRELATION_ID);
  });

  it('replaces a malformed correlation id rather than propagating it', async () => {
    const body = parse(
      (await handler({ headers: { 'x-correlation-id': '-not valid-' } })).body,
    ) as {
      correlation_id: string;
    };

    expect(body.correlation_id).not.toBe('-not valid-');
    expect(body.correlation_id).toMatch(ID_PATTERN);
  });

  it('issues a distinct correlation id per request when none is supplied', async () => {
    const first = parse((await handler({})).body) as { correlation_id: string };
    const second = parse((await handler({})).body) as { correlation_id: string };

    expect(first.correlation_id).not.toBe(second.correlation_id);
  });
});

describe('structured logging', () => {
  let logs: Record<string, unknown>[];

  beforeEach(() => {
    logs = captureLogs();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('emits one JSON line carrying service, event, correlation_id and outcome', async () => {
    const body = parse((await handler({})).body) as { correlation_id: string };

    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      service: 'returnshield',
      event: 'health.request',
      correlation_id: body.correlation_id,
      outcome: 'success',
    });
  });

  it('logs the same correlation id the caller supplied', async () => {
    await handler({ headers: { 'x-correlation-id': CALLER_CORRELATION_ID } });

    expect(logs[0]?.['correlation_id']).toBe(CALLER_CORRELATION_ID);
  });
});
