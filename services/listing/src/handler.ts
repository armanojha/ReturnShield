import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import {
  assertValid,
  errorEnvelope,
  isValidCorrelationId,
  resolveCorrelationId,
} from '@returnshield/contracts';
import { createRepositories, DynamoDbRepositoryStore } from '@returnshield/data';
import {
  DynamoDbIdempotencyStore,
  buildReservationInput,
  completeReservation,
  failReservation,
  listingAnalyzeIdempotencyKey,
  reserveOrReplay,
} from '@returnshield/shared';
import type { APIGatewayProxyResult, APIGatewayProxyEvent } from 'aws-lambda';

import { BedrockListingGuardClient, modelId } from './ai/client.js';
import { mapListingAnalysis } from './ai/mapper.js';
import { validateListingGuardOutput } from './ai/validator.js';
import type { ListingInput, ListingAnalysisResult } from './types.js';

const tableName = process.env.RETURNSHIELD_TABLE_NAME ?? '';
const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const repositories = tableName
  ? createRepositories(new DynamoDbRepositoryStore(tableName, documentClient))
  : undefined;
const idempotency = tableName
  ? new DynamoDbIdempotencyStore({ tableName, documentClient })
  : undefined;
const model = new BedrockListingGuardClient();

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

function errorResponse(
  statusCode: number,
  correlationId: string,
  code: Parameters<typeof errorEnvelope>[1],
  message: string,
  retryable = false,
) {
  return response(
    statusCode,
    errorEnvelope(correlationId, code, message, { retryable }),
    correlationId,
  );
}

function bodyOf(event: APIGatewayProxyEvent): unknown {
  if (!event.body) return undefined;
  const text = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;
  return JSON.parse(text);
}

export async function postAnalyze(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const correlationId = resolveCorrelationId(header(event, 'x-correlation-id'));
  const idempotencyKey = header(event, 'idempotency-key');
  if (!idempotencyKey || !isValidCorrelationId(idempotencyKey))
    return errorResponse(400, correlationId, 'VALIDATION_ERROR', 'Idempotency-Key is required.');
  let input: ListingInput;
  try {
    input = assertValid<ListingInput>('ListingRequest', bodyOf(event));
  } catch {
    return errorResponse(400, correlationId, 'VALIDATION_ERROR', 'Listing request is invalid.');
  }
  if (!repositories || !idempotency)
    return errorResponse(
      500,
      correlationId,
      'INTERNAL_ERROR',
      'Listing service is not configured.',
      true,
    );

  const reservationInput = buildReservationInput(
    'LISTING_ANALYZE',
    listingAnalyzeIdempotencyKey(idempotencyKey),
    input,
    input.listing_id,
  );
  const reservation = await reserveOrReplay<ListingAnalysisResult>(idempotency, reservationInput);
  if (reservation.kind === 'CONFLICT')
    return errorResponse(
      409,
      correlationId,
      'IDEMPOTENCY_CONFLICT',
      'The idempotency key was already used with a different request.',
    );
  if (reservation.kind === 'IN_PROGRESS')
    return errorResponse(
      409,
      correlationId,
      'REQUEST_IN_PROGRESS',
      'An identical listing analysis is already in progress.',
      true,
    );
  if (reservation.kind === 'COMPLETED')
    return response(200, reservation.record.result, correlationId);

  try {
    const raw = await model.analyze(input);
    const analysis = validateListingGuardOutput(raw, input);
    const listing = mapListingAnalysis(input, analysis, {
      model_id: modelId(model),
      correlation_id: correlationId,
    });
    await repositories.listings.create(listing);
    const result = assertValid<ListingAnalysisResult>('ListingResponse', {
      schema_version: '1.0.0',
      correlation_id: correlationId,
      data: listing,
    });
    await completeReservation(idempotency, reservationInput, result, input.listing_id);
    return response(201, result, correlationId);
  } catch (error) {
    await failReservation(idempotency, reservationInput);
    if (error instanceof Error && error.name === 'RepositoryConflictError')
      return errorResponse(
        409,
        correlationId,
        'IDEMPOTENCY_CONFLICT',
        'A listing with this ID already exists.',
      );
    return errorResponse(
      503,
      correlationId,
      'AI_UNAVAILABLE',
      'ListingGuard could not produce a validated result.',
      true,
    );
  }
}

export async function getListing(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const correlationId = resolveCorrelationId(header(event, 'x-correlation-id'));
  const listingId = event.pathParameters?.listing_id;
  if (!listingId || !repositories)
    return errorResponse(
      listingId ? 500 : 400,
      correlationId,
      listingId ? 'INTERNAL_ERROR' : 'VALIDATION_ERROR',
      listingId ? 'Listing service is not configured.' : 'listing_id is required.',
      true,
    );
  try {
    const listing = await repositories.listings.get(listingId);
    if (!listing) return errorResponse(404, correlationId, 'NOT_FOUND', 'Listing was not found.');
    return response(
      200,
      assertValid('ListingResponse', {
        schema_version: '1.0.0',
        correlation_id: correlationId,
        data: listing,
      }),
      correlationId,
    );
  } catch {
    return errorResponse(
      500,
      correlationId,
      'INTERNAL_ERROR',
      'Listing could not be loaded.',
      true,
    );
  }
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  if (event.httpMethod === 'GET') return getListing(event);
  return postAnalyze(event);
}

export default handler;
