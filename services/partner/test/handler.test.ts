import type { APIGatewayProxyEvent } from 'aws-lambda';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createPartnerHandler } from '../src/handler.js';
import type { Repositories } from '@returnshield/data';
import type { IdempotencyRecord, IdempotencyStoreClient } from '@returnshield/shared';

function event(body: unknown, key = 'context-order-1'): APIGatewayProxyEvent {
  return {
    body: JSON.stringify(body),
    headers: { 'idempotency-key': key },
    multiValueHeaders: {},
    httpMethod: 'POST',
    isBase64Encoded: false,
    path: '/v1/partner/context',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as APIGatewayProxyEvent['requestContext'],
    resource: '/v1/partner/context',
  };
}

const seller = {
  schema_version: '1.0.0' as const,
  seller_id: 'SELLER-demo',
  trust_score: 90,
  listing_flags: 0,
  return_rate: 0.02,
  dispute_count: 0,
  cases: [],
};
const customer = {
  schema_version: '1.0.0' as const,
  customer_id: 'CUSTOMER-demo',
  return_count: 0,
  recent_returns: 0,
  account_age_days: 180,
  case_history: [],
};
const order = {
  schema_version: '1.0.0' as const,
  order_id: 'ORDER-demo',
  seller_id: 'SELLER-demo',
  customer_id: 'CUSTOMER-demo',
  listing_id: 'LISTING-demo',
  timestamp: '2026-09-20T00:00:00Z',
  status: 'DELIVERED' as const,
  delivered_at: '2026-09-20T00:00:00Z',
};

function dependencies() {
  const records = new Map<string, IdempotencyRecord>();
  const idempotency: IdempotencyStoreClient = {
    async putIfAbsent(record) {
      const key = `${record.pk}|${record.sk}`;
      if (records.has(key)) return 'ALREADY_EXISTS';
      records.set(key, record);
      return 'CREATED';
    },
    async get(pk, sk) {
      return records.get(`${pk}|${sk}`);
    },
    async complete(pk, sk, _hash, result, logicalId) {
      const current = records.get(`${pk}|${sk}`);
      if (!current) return 'STALE';
      records.set(`${pk}|${sk}`, {
        ...current,
        status: 'COMPLETED',
        result,
        logical_id: logicalId,
      });
      return 'UPDATED';
    },
    async markFailedRecoverable() {
      return 'UPDATED';
    },
    async resume() {
      return 'RESUMED';
    },
  };
  const repositories = {
    sellers: { put: async () => seller },
    customers: { put: async () => customer },
    orders: { put: async () => order },
    listings: {
      get: async () => ({
        schema_version: '1.0.0',
        listing_id: 'LISTING-demo',
        seller_id: 'SELLER-demo',
        title: 'Demo',
        description: 'Demo',
        category: 'HOME',
        listing_risk: 'low',
        status: 'PASS',
        analysis: {},
        analysis_metadata: {},
        created_at: '2026-09-20T00:00:00Z',
      }),
    },
  } as unknown as Repositories;
  return { repositories, idempotency };
}

describe('partner context handler', () => {
  it('validates, persists and replays synthetic order context', async () => {
    const deps = dependencies();
    const handler = createPartnerHandler(deps);
    const body = { schema_version: '1.0.0', partner_id: 'demo-store', seller, customer, order };
    const first = await handler(event(body));
    const replay = await handler(event(body));
    expect(first.statusCode).toBe(201);
    expect(replay.statusCode).toBe(200);
    expect(JSON.parse(replay.body).data.replayed).toBe(false);
  });

  it('rejects mismatched order ownership before writing context', async () => {
    const deps = dependencies();
    const handler = createPartnerHandler(deps);
    const response = await handler(
      event({
        schema_version: '1.0.0',
        partner_id: 'demo-store',
        seller,
        customer,
        order: { ...order, customer_id: 'CUSTOMER-other' },
      }),
    );
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects mismatched seller ownership before writing context', async () => {
    const deps = dependencies();
    const handler = createPartnerHandler(deps);
    const response = await handler(
      event({
        schema_version: '1.0.0',
        partner_id: 'demo-store',
        seller,
        customer,
        order: { ...order, seller_id: 'SELLER-other' },
      }),
    );
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error.code).toBe('VALIDATION_ERROR');
  });

  it('returns ERROR_MISSING_CONTEXT without writing when the listing is unavailable for the seller, never fabricating success', async () => {
    const deps = dependencies();
    (deps.repositories as unknown as { listings: { get: () => Promise<undefined> } }).listings = {
      get: async () => undefined,
    };
    let writeCalls = 0;
    const originalSellerPut = deps.repositories.sellers.put;
    deps.repositories.sellers.put = async (value) => {
      writeCalls += 1;
      return originalSellerPut(value);
    };
    const handler = createPartnerHandler(deps);
    const body = { schema_version: '1.0.0', partner_id: 'demo-store', seller, customer, order };
    const response = await handler(event(body));
    expect(response.statusCode).toBe(422);
    expect(JSON.parse(response.body).error.code).toBe('ERROR_MISSING_CONTEXT');
    expect(writeCalls).toBe(0);
  });

  it('returns ERROR_MISSING_CONTEXT when the listing belongs to a different seller', async () => {
    const deps = dependencies();
    (
      deps.repositories as unknown as {
        listings: { get: () => Promise<{ seller_id: string }> };
      }
    ).listings = { get: async () => ({ seller_id: 'SELLER-other' }) };
    const handler = createPartnerHandler(deps);
    const body = { schema_version: '1.0.0', partner_id: 'demo-store', seller, customer, order };
    const response = await handler(event(body));
    expect(response.statusCode).toBe(422);
    expect(JSON.parse(response.body).error.code).toBe('ERROR_MISSING_CONTEXT');
  });

  it('replays the exact stored result for a repeated idempotency key instead of re-running side effects', async () => {
    const deps = dependencies();
    let writeCount = 0;
    const originalPut = deps.repositories.orders.put;
    deps.repositories.orders.put = async (value) => {
      writeCount += 1;
      return originalPut(value);
    };
    const handler = createPartnerHandler(deps);
    const body = { schema_version: '1.0.0', partner_id: 'demo-store', seller, customer, order };
    await handler(event(body, 'context-replay-1'));
    await handler(event(body, 'context-replay-1'));
    await handler(event(body, 'context-replay-1'));
    expect(writeCount).toBe(1);
  });

  it('rejects a request that omits the Idempotency-Key header', async () => {
    const deps = dependencies();
    const handler = createPartnerHandler(deps);
    const body = { schema_version: '1.0.0', partner_id: 'demo-store', seller, customer, order };
    const request = event(body);
    delete (request.headers as Record<string, string>)['idempotency-key'];
    const response = await handler(request);
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error.code).toBe('VALIDATION_ERROR');
  });
});

describe('partner handler missing configuration', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('returns a 500 INTERNAL_ERROR without touching storage when RETURNSHIELD_TABLE_NAME is unset', async () => {
    vi.resetModules();
    vi.stubEnv('RETURNSHIELD_TABLE_NAME', '');
    const { handler: unconfiguredHandler } = await import('../src/handler.js');
    const response = await unconfiguredHandler(
      event({ schema_version: '1.0.0', partner_id: 'demo-store', seller, customer, order }),
    );
    expect(response.statusCode).toBe(500);
    const parsed = JSON.parse(response.body);
    expect(parsed.error.code).toBe('INTERNAL_ERROR');
    expect(parsed.error.retryable).toBe(true);
  });
});
