/**
 * `GET /v1/health` — Phase 01 (task P1-API-01).
 *
 * The response body is built by the shared contracts package and validated
 * against the frozen `HealthResponse` schema before it leaves the function. A
 * body that cannot satisfy the frozen contract is reported as a structured
 * `INTERNAL_ERROR` rather than returned as a loose 200: an error must never
 * masquerade as a healthy result.
 */
import {
  assertValid,
  errorEnvelope,
  healthEnvelope,
  resolveCorrelationId,
} from '@returnshield/contracts';
import type { ApiErrorEnvelope, HealthResponse } from '@returnshield/contracts';
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResult,
  APIGatewayProxyEvent,
} from 'aws-lambda';

import { logger } from './logger.js';

const CORRELATION_HEADER = 'x-correlation-id';

/** Both REST (v1) and HTTP API (v2) proxy shapes are accepted. */
type HealthEvent = Partial<APIGatewayProxyEvent> & Partial<APIGatewayProxyEventV2>;

function headerValue(event: HealthEvent, name: string): string | undefined {
  const headers = event.headers ?? {};
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === name && typeof value === 'string') return value;
  }
  return undefined;
}

function response(
  statusCode: number,
  body: HealthResponse | ApiErrorEnvelope,
  correlationId: string,
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      [CORRELATION_HEADER]: correlationId,
    },
    body: JSON.stringify(body),
  };
}

export async function handler(event: HealthEvent = {}): Promise<APIGatewayProxyResult> {
  const correlationId = resolveCorrelationId(headerValue(event, CORRELATION_HEADER));

  try {
    const body = assertValid<HealthResponse>('HealthResponse', healthEnvelope(correlationId));

    logger.info({
      event: 'health.request',
      correlation_id: correlationId,
      outcome: 'success',
      status_code: 200,
    });

    return response(200, body, correlationId);
  } catch (error) {
    logger.error({
      event: 'health.request',
      correlation_id: correlationId,
      outcome: 'failure',
      status_code: 500,
      // Class name only. Messages and stacks stay out of logs and responses.
      error_kind: error instanceof Error ? error.name : 'UnknownError',
    });

    return response(
      500,
      errorEnvelope(correlationId, 'INTERNAL_ERROR', 'Health check could not be completed.', {
        retryable: true,
      }),
      correlationId,
    );
  }
}

export default handler;
