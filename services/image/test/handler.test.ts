import { describe, expect, it, vi } from 'vitest';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import type { ImageEvidence, Repositories } from '@returnshield/data';

import { InMemoryIdempotencyStore } from '../../shared/test/support/in-memory-idempotency-store.js';
import { createImageHandler } from '../src/handler.js';

function event(
  resource: string,
  method: string,
  body?: unknown,
  imageId?: string,
): APIGatewayProxyEvent {
  return {
    resource,
    path: resource,
    httpMethod: method,
    headers: { 'idempotency-key': `key-${method.toLowerCase()}-1` },
    multiValueHeaders: {},
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    pathParameters: imageId ? { image_id: imageId } : null,
    stageVariables: null,
    requestContext: {} as APIGatewayProxyEvent['requestContext'],
    body: body === undefined ? null : JSON.stringify(body),
    isBase64Encoded: false,
  };
}
function png(): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  new DataView(bytes.buffer).setUint32(16, 64);
  new DataView(bytes.buffer).setUint32(20, 64);
  return bytes;
}

describe('image API handler', () => {
  it('creates, analyzes and exactly replays an upload lifecycle', async () => {
    const images = new Map<string, ImageEvidence>();
    const repositories = {
      listings: {
        get: vi.fn(async () => ({
          title: 'Cotton shirt',
          description: 'Sealed',
          category: 'APPAREL',
        })),
      },
      cases: { get: vi.fn() },
      images: {
        create: vi.fn(async (item: ImageEvidence) => {
          images.set(item.image_id, item);
          return item;
        }),
        put: vi.fn(async (item: ImageEvidence) => {
          images.set(item.image_id, item);
          return item;
        }),
        get: vi.fn(async (id: string) => images.get(id)),
        listByListing: vi.fn(async () => [...images.values()]),
        listByCase: vi.fn(async () => []),
      },
    } as unknown as Repositories;
    const model = {
      analyze: vi.fn(async (context: { image_id: string }) => ({
        schema_version: '1.0.0',
        summary: 'A sealed shirt package is visible.',
        findings: ['Packaging appears sealed.'],
        evidence_refs: [context.image_id],
        recommended_action: 'NONE',
      })),
    };
    const handler = createImageHandler({
      repositories,
      idempotency: new InMemoryIdempotencyStore(),
      model,
      modelId: 'amazon.nova-lite-v1:0',
      bucket: {
        presignUpload: vi.fn(async () => ({
          url: 'https://upload.example/signed',
          expiresAt: new Date(Date.now() + 300_000).toISOString(),
        })),
        presignDownload: vi.fn(async () => ({
          url: 'https://download.example/signed',
          expiresAt: new Date(Date.now() + 300_000).toISOString(),
        })),
        readObject: vi.fn(async () => png()),
      },
    });
    const uploadEvent = event('/v1/images/uploads', 'POST', {
      schema_version: '1.0.0',
      subject_type: 'LISTING',
      subject_id: 'LISTING-clean',
      content_type: 'image/png',
    });
    const first = await handler(uploadEvent);
    const replay = await handler(uploadEvent);
    expect(first.statusCode).toBe(201);
    expect(replay.statusCode).toBe(200);
    expect(replay.body).toBe(first.body);
    expect(repositories.images.create).toHaveBeenCalledTimes(1);
    const imageId = (JSON.parse(first.body) as { data: { image_id: string } }).data.image_id;
    const completeEvent = event(
      '/v1/images/{image_id}/complete',
      'POST',
      { schema_version: '1.0.0' },
      imageId,
    );
    const completed = await handler(completeEvent);
    const completeReplay = await handler(completeEvent);
    expect(completed.statusCode).toBe(200);
    expect(completeReplay.body).toBe(completed.body);
    expect((JSON.parse(completed.body) as { data: ImageEvidence }).data.analysis_status).toBe(
      'AVAILABLE',
    );
    expect(model.analyze).toHaveBeenCalledTimes(1);
  });
});
