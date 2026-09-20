import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import {
  assertValidEntity,
  errorEnvelope,
  isValidCorrelationId,
  resolveCorrelationId,
} from '@returnshield/contracts';
import { createRepositories, DynamoDbRepositoryStore } from '@returnshield/data';
import type { Customer, Order, Repositories, Seller } from '@returnshield/data';
import {
  buildReservationInput,
  completeReservation,
  DynamoDbIdempotencyStore,
  failReservation,
  partnerContextIdempotencyKey,
  reserveOrReplay,
} from '@returnshield/shared';
import type { IdempotencyStoreClient } from '@returnshield/shared';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

interface PartnerContextRequest {
  schema_version: '1.0.0';
  partner_id: string;
  seller: Seller;
  customer: Customer;
  order: Order;
}

interface PartnerContextResponse {
  schema_version: '1.0.0';
  correlation_id: string;
  data: {
    partner_id: string;
    seller_id: string;
    customer_id: string;
    listing_id: string;
    order_id: string;
    replayed: boolean;
  };
}

export interface PartnerHandlerDependencies {
  repositories: Repositories;
  idempotency: IdempotencyStoreClient;
}

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
  statusCode: number,
  correlationId: string,
  code: Parameters<typeof errorEnvelope>[1],
  message: string,
  retryable = false,
): APIGatewayProxyResult {
  return response(
    statusCode,
    errorEnvelope(correlationId, code, message, { retryable }),
    correlationId,
  );
}

function parseRequest(event: APIGatewayProxyEvent): PartnerContextRequest {
  if (!event.body) throw new Error('Body is required');
  const raw = JSON.parse(
    event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body,
  ) as unknown;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid body');
  const value = raw as Record<string, unknown>;
  const keys = Object.keys(value).sort();
  if (
    JSON.stringify(keys) !==
    JSON.stringify(['customer', 'order', 'partner_id', 'schema_version', 'seller'])
  )
    throw new Error('Unexpected fields');
  if (value.schema_version !== '1.0.0') throw new Error('Invalid schema version');
  if (
    typeof value.partner_id !== 'string' ||
    !isValidCorrelationId(value.partner_id) ||
    value.partner_id !== 'demo-store'
  )
    throw new Error('Invalid partner');
  return {
    schema_version: '1.0.0',
    partner_id: value.partner_id,
    seller: assertValidEntity<Seller>('Seller', value.seller),
    customer: assertValidEntity<Customer>('Customer', value.customer),
    order: assertValidEntity<Order>('Order', value.order),
  };
}

function envelope(
  correlationId: string,
  request: PartnerContextRequest,
  replayed: boolean,
): PartnerContextResponse {
  return {
    schema_version: '1.0.0',
    correlation_id: correlationId,
    data: {
      partner_id: request.partner_id,
      seller_id: request.seller.seller_id,
      customer_id: request.customer.customer_id,
      listing_id: request.order.listing_id,
      order_id: request.order.order_id,
      replayed,
    },
  };
}

export function createPartnerHandler(dependencies: PartnerHandlerDependencies) {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const correlationId = resolveCorrelationId(header(event, 'x-correlation-id'));
    const idempotencyKey = header(event, 'idempotency-key');
    if (!idempotencyKey || !isValidCorrelationId(idempotencyKey))
      return failure(400, correlationId, 'VALIDATION_ERROR', 'Idempotency-Key is required.');

    let request: PartnerContextRequest;
    try {
      request = parseRequest(event);
    } catch {
      return failure(400, correlationId, 'VALIDATION_ERROR', 'Partner context is invalid.');
    }

    if (
      request.order.seller_id !== request.seller.seller_id ||
      request.order.customer_id !== request.customer.customer_id
    )
      return failure(
        400,
        correlationId,
        'VALIDATION_ERROR',
        'Order identifiers do not match the supplied seller and customer.',
      );

    const listing = await dependencies.repositories.listings.get(request.order.listing_id);
    if (!listing || listing.seller_id !== request.seller.seller_id)
      return failure(
        422,
        correlationId,
        'ERROR_MISSING_CONTEXT',
        'The analyzed listing is unavailable for this seller.',
      );

    const reservationInput = buildReservationInput(
      'PARTNER_CONTEXT',
      partnerContextIdempotencyKey(idempotencyKey),
      request,
      request.order.order_id,
    );
    const reservation = await reserveOrReplay<PartnerContextResponse>(
      dependencies.idempotency,
      reservationInput,
    );
    if (reservation.kind === 'CONFLICT')
      return failure(
        409,
        correlationId,
        'IDEMPOTENCY_CONFLICT',
        'The idempotency key was already used with different context.',
      );
    if (reservation.kind === 'IN_PROGRESS')
      return failure(
        409,
        correlationId,
        'REQUEST_IN_PROGRESS',
        'Partner context synchronization is in progress.',
        true,
      );
    if (reservation.kind === 'COMPLETED')
      return response(200, reservation.record.result, correlationId);

    try {
      await Promise.all([
        dependencies.repositories.sellers.put(request.seller),
        dependencies.repositories.customers.put(request.customer),
      ]);
      await dependencies.repositories.orders.put(request.order);
      const result = envelope(correlationId, request, false);
      await completeReservation(
        dependencies.idempotency,
        reservationInput,
        result,
        request.order.order_id,
      );
      return response(201, result, correlationId);
    } catch {
      await failReservation(dependencies.idempotency, reservationInput);
      return failure(
        500,
        correlationId,
        'INTERNAL_ERROR',
        'Partner context could not be synchronized.',
        true,
      );
    }
  };
}

const tableName = process.env.RETURNSHIELD_TABLE_NAME ?? '';
const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const repositories = tableName
  ? createRepositories(new DynamoDbRepositoryStore(tableName, documentClient))
  : undefined;
const idempotency = tableName
  ? new DynamoDbIdempotencyStore({ tableName, documentClient })
  : undefined;

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  if (!repositories || !idempotency) {
    const correlationId = resolveCorrelationId(header(event, 'x-correlation-id'));
    return failure(
      500,
      correlationId,
      'INTERNAL_ERROR',
      'Partner integration is not configured.',
      true,
    );
  }
  return createPartnerHandler({ repositories, idempotency })(event);
}

export default handler;
