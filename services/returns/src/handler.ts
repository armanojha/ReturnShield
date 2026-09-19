import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { assertValid, errorEnvelope, resolveCorrelationId } from '@returnshield/contracts';
import { createRepositories, DynamoDbRepositoryStore } from '@returnshield/data';
import type { Evidence, ReturnCase } from '@returnshield/data';
import {
  DynamoDbIdempotencyStore,
  buildReservationInput,
  completeReservation,
  failReservation,
  reserveOrReplay,
  returnIdempotencyKey,
} from '@returnshield/shared';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

interface ReturnRequest {
  schema_version: '1.0.0';
  order_id: string;
  reason: ReturnCase['reason'];
  evidence: Evidence[];
}
interface ReturnResponse {
  schema_version: '1.0.0';
  correlation_id: string;
  data: { case: ReturnCase; replayed: boolean };
}

const tableName = process.env.RETURNSHIELD_TABLE_NAME ?? '';
const stateMachineArn = process.env.RETURNSHIELD_RETURN_WORKFLOW_ARN ?? '';
const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const repositories = tableName
  ? createRepositories(new DynamoDbRepositoryStore(tableName, documentClient))
  : undefined;
const idempotency = tableName
  ? new DynamoDbIdempotencyStore({ tableName, documentClient })
  : undefined;
const sfn = new SFNClient({});

function header(event: APIGatewayProxyEvent, name: string): string | undefined {
  for (const [key, value] of Object.entries(event.headers ?? {}))
    if (key.toLowerCase() === name && typeof value === 'string') return value;
  return undefined;
}
function response(statusCode: number, body: unknown, correlationId: string): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      'x-correlation-id': correlationId,
    },
    body: JSON.stringify(body),
  };
}
function failure(
  status: number,
  correlationId: string,
  code: Parameters<typeof errorEnvelope>[1],
  message: string,
  retryable = false,
) {
  return response(
    status,
    errorEnvelope(correlationId, code, message, { retryable }),
    correlationId,
  );
}
function parseBody(event: APIGatewayProxyEvent): unknown {
  if (!event.body) return undefined;
  return JSON.parse(
    event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body,
  );
}
function caseId(orderId: string) {
  return `CASE-${orderId.replace(/^ORDER-/, '')}`;
}
function processingCase(
  request: ReturnRequest,
  order: { seller_id: string; listing_id: string; customer_id: string },
  id: string,
  now: string,
): ReturnCase {
  return {
    schema_version: '1.0.0',
    case_id: id,
    order_id: request.order_id,
    seller_id: order.seller_id,
    listing_id: order.listing_id,
    customer_id: order.customer_id,
    reason: request.reason,
    evidence: request.evidence,
    status: 'PROCESSING',
    revision: 0,
    raw_contribution_total: null,
    risk_score: null,
    policy_version: '1.0.0',
    decision: null,
    priority: null,
    contributions: [],
    review_status: 'NOT_APPLICABLE',
    reviewer_disposition: null,
    explanation_status: 'NOT_REQUESTED',
    explanation: null,
    error: null,
    timeline: [
      {
        schema_version: '1.0.0',
        event_id: `${id}-RETURN_RECEIVED`,
        case_id: id,
        timestamp: now,
        type: 'RETURN_RECEIVED',
        actor_id: 'SYSTEM',
        message: 'RETURN_RECEIVED',
      },
    ],
    created_at: now,
    updated_at: now,
  };
}
function envelope(correlationId: string, value: ReturnCase, replayed: boolean): ReturnResponse {
  return assertValid<ReturnResponse>('ReturnResponse', {
    schema_version: '1.0.0',
    correlation_id: correlationId,
    data: { case: value, replayed },
  });
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const correlationId = resolveCorrelationId(header(event, 'x-correlation-id'));
  let request: ReturnRequest;
  try {
    request = assertValid<ReturnRequest>('ReturnRequest', parseBody(event));
  } catch {
    return failure(400, correlationId, 'VALIDATION_ERROR', 'Return request is invalid.');
  }
  if (!repositories || !idempotency || !stateMachineArn)
    return failure(500, correlationId, 'INTERNAL_ERROR', 'Return service is not configured.', true);
  const order = await repositories.orders.get(request.order_id);
  if (!order) return failure(404, correlationId, 'NOT_FOUND', 'Order was not found.');
  const [seller, listing, customer] = await Promise.all([
    repositories.sellers.get(order.seller_id),
    repositories.listings.get(order.listing_id),
    repositories.customers.get(order.customer_id),
  ]);
  if (!seller || !listing || !customer)
    return failure(
      422,
      correlationId,
      'ERROR_MISSING_CONTEXT',
      'Required order context is unavailable.',
    );
  const id = caseId(order.order_id);
  const now = new Date().toISOString();
  const pending = processingCase(request, order, id, now);
  const reservationInput = buildReservationInput(
    'RETURN',
    returnIdempotencyKey(request.order_id),
    request,
    id,
  );
  const reservation = await reserveOrReplay<ReturnCase>(idempotency, reservationInput);
  if (reservation.kind === 'CONFLICT')
    return failure(
      409,
      correlationId,
      'IDEMPOTENCY_CONFLICT',
      'This order already has a different return request.',
    );
  if (reservation.kind === 'COMPLETED') {
    const current = await repositories.cases.get(id);
    const value = current ?? reservation.record.result ?? pending;
    return response(current ? 200 : 202, envelope(correlationId, value, true), correlationId);
  }
  if (reservation.kind === 'IN_PROGRESS')
    return response(202, envelope(correlationId, pending, true), correlationId);
  try {
    await sfn.send(
      new StartExecutionCommand({
        stateMachineArn,
        name: id,
        input: JSON.stringify({
          schema_version: '1.0.0',
          correlation_id: correlationId,
          case_id: id,
          request,
        }),
      }),
    );
    await completeReservation(idempotency, reservationInput, pending, id);
    return response(202, envelope(correlationId, pending, false), correlationId);
  } catch (error) {
    if (error instanceof Error && error.name === 'ExecutionAlreadyExists') {
      await completeReservation(idempotency, reservationInput, pending, id);
      return response(202, envelope(correlationId, pending, true), correlationId);
    }
    await failReservation(idempotency, reservationInput);
    return failure(
      500,
      correlationId,
      'INTERNAL_ERROR',
      'Return workflow could not be started.',
      true,
    );
  }
}

export default handler;
