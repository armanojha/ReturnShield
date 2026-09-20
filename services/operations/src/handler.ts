import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { assertValid, errorEnvelope, resolveCorrelationId } from '@returnshield/contracts';
import {
  createRepositories,
  DynamoDbRepositoryStore,
  RepositoryConflictError,
  type ReturnCase,
} from '@returnshield/data';
import {
  buildReservationInput,
  caseDecisionIdempotencyKey,
  completeReservation,
  DynamoDbIdempotencyStore,
  failReservation,
  reserveOrReplay,
} from '@returnshield/shared';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

interface DecisionRequest {
  schema_version: '1.0.0';
  expected_revision: number;
  action: 'APPROVE_RETURN' | 'DECLINE_RETURN';
  note: string;
}

const tableName = process.env.RETURNSHIELD_TABLE_NAME ?? '';
const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const repositories = tableName
  ? createRepositories(new DynamoDbRepositoryStore(tableName, documentClient))
  : undefined;
const idempotency = tableName
  ? new DynamoDbIdempotencyStore({ tableName, documentClient })
  : undefined;

function header(event: APIGatewayProxyEvent, name: string): string | undefined {
  return (
    Object.entries(event.headers ?? {}).find(([key]) => key.toLowerCase() === name)?.[1] ??
    undefined
  );
}
function reply(statusCode: number, body: unknown, correlationId: string): APIGatewayProxyResult {
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
  id: string,
  code: Parameters<typeof errorEnvelope>[1],
  message: string,
  retryable = false,
) {
  return reply(status, errorEnvelope(id, code, message, { retryable }), id);
}
function envelope(correlationId: string, data: unknown) {
  return { schema_version: '1.0.0', correlation_id: correlationId, data };
}
function pathId(event: APIGatewayProxyEvent, name: string) {
  return event.pathParameters?.[name];
}
function parseBody(event: APIGatewayProxyEvent): unknown {
  if (!event.body) return undefined;
  return JSON.parse(
    event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body,
  );
}

type Filters = {
  status?: string;
  priority?: string;
  decision?: string;
  seller_id?: string;
  review_status?: string;
};
function filtered(cases: ReturnCase[], filters: Filters) {
  return cases
    .filter((item) =>
      Object.entries(filters).every(
        ([key, value]) => !value || String(item[key as keyof ReturnCase]) === value,
      ),
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || a.case_id.localeCompare(b.case_id));
}
function decodeCursor(value: string | undefined, filterKey: string): number {
  if (!value) return 0;
  const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as {
    offset?: unknown;
    filters?: unknown;
  };
  if (!Number.isInteger(parsed.offset) || Number(parsed.offset) < 0 || parsed.filters !== filterKey)
    throw new Error('invalid cursor');
  return Number(parsed.offset);
}

async function listCases(event: APIGatewayProxyEvent, id: string) {
  const query = event.queryStringParameters ?? {};
  const allowed = new Set([
    'limit',
    'cursor',
    'status',
    'priority',
    'decision',
    'seller_id',
    'review_status',
  ]);
  if (Object.keys(query).some((key) => !allowed.has(key)))
    return failure(400, id, 'VALIDATION_ERROR', 'Case query is invalid.');
  const limit = query.limit === undefined ? 25 : Number(query.limit);
  const candidate = {
    ...(query.limit === undefined ? {} : { limit }),
    ...(query.cursor ? { cursor: query.cursor } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.priority ? { priority: query.priority } : {}),
    ...(query.decision ? { decision: query.decision } : {}),
    ...(query.seller_id ? { seller_id: query.seller_id } : {}),
    ...(query.review_status ? { review_status: query.review_status } : {}),
  };
  try {
    assertValid('CaseQuery', candidate);
    const filters: Filters = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.decision ? { decision: query.decision } : {}),
      ...(query.seller_id ? { seller_id: query.seller_id } : {}),
      ...(query.review_status ? { review_status: query.review_status } : {}),
    };
    const filterKey = JSON.stringify(filters);
    const start = decodeCursor(query.cursor ?? undefined, filterKey);
    const all = filtered(await repositories!.cases.listAll(), filters);
    const items = all.slice(start, start + limit);
    const next =
      start + items.length < all.length
        ? Buffer.from(
            JSON.stringify({ offset: start + items.length, filters: filterKey }),
          ).toString('base64url')
        : null;
    return reply(200, assertValid('CasesResponse', envelope(id, { items, next_cursor: next })), id);
  } catch {
    return failure(400, id, 'VALIDATION_ERROR', 'Case query is invalid.');
  }
}

async function dashboard(id: string) {
  const [cases, listings] = await Promise.all([
    repositories!.cases.listAll(),
    repositories!.listings.listAll(),
  ]);
  const data = {
    as_of: new Date().toISOString(),
    flagged_listings: listings.filter((item) => item.status === 'CORRECTION_REQUIRED').length,
    auto_approved_returns: cases.filter(
      (item) => item.status === 'DECIDED' && item.decision === 'AUTO_APPROVE',
    ).length,
    normal_review_cases: cases.filter(
      (item) =>
        item.status === 'DECIDED' && item.decision === 'NEEDS_REVIEW' && item.priority === 'NORMAL',
    ).length,
    high_review_cases: cases.filter(
      (item) =>
        item.status === 'DECIDED' && item.decision === 'NEEDS_REVIEW' && item.priority === 'HIGH',
    ).length,
    open_review_cases: cases.filter(
      (item) =>
        item.status === 'DECIDED' &&
        item.decision === 'NEEDS_REVIEW' &&
        item.review_status === 'OPEN',
    ).length,
    missing_context_cases: cases.filter((item) => item.status === 'ERROR_MISSING_CONTEXT').length,
  };
  return reply(200, assertValid('DashboardResponse', envelope(id, data)), id);
}

async function decide(event: APIGatewayProxyEvent, id: string, caseId: string) {
  const key = header(event, 'idempotency-key');
  if (!key) return failure(400, id, 'VALIDATION_ERROR', 'Idempotency-Key is required.');
  let input: DecisionRequest;
  try {
    input = assertValid<DecisionRequest>('DecisionRequest', parseBody(event));
  } catch {
    return failure(400, id, 'VALIDATION_ERROR', 'Decision request is invalid.');
  }
  const reservationInput = buildReservationInput(
    'CASE_DECISION',
    caseDecisionIdempotencyKey(caseId, key),
    input,
    caseId,
  );
  const reservation = await reserveOrReplay<ReturnCase>(idempotency!, reservationInput);
  if (reservation.kind === 'CONFLICT')
    return failure(
      409,
      id,
      'IDEMPOTENCY_CONFLICT',
      'Idempotency key was used with different input.',
    );
  if (reservation.kind === 'IN_PROGRESS')
    return failure(409, id, 'REQUEST_IN_PROGRESS', 'Decision is already in progress.', true);
  if (reservation.kind === 'COMPLETED')
    return reply(200, assertValid('DecisionResponse', envelope(id, reservation.record.result)), id);
  try {
    const current = await repositories!.cases.get(caseId);
    if (!current) {
      await failReservation(idempotency!, reservationInput);
      return failure(404, id, 'NOT_FOUND', 'Case was not found.');
    }
    if (current.revision !== input.expected_revision) {
      await failReservation(idempotency!, reservationInput);
      return failure(409, id, 'REVISION_CONFLICT', 'Case revision has changed.');
    }
    if (
      current.status !== 'DECIDED' ||
      current.decision !== 'NEEDS_REVIEW' ||
      current.review_status !== 'OPEN'
    ) {
      await failReservation(idempotency!, reservationInput);
      return failure(409, id, 'INVALID_STATE', 'Case is not open for review.');
    }
    const now = new Date().toISOString();
    const next: ReturnCase = {
      ...current,
      review_status: 'RESOLVED',
      reviewer_disposition: {
        schema_version: '1.0.0',
        action: input.action,
        actor_id: 'DEMO_REVIEWER',
        note: input.note,
        decided_at: now,
      },
      revision: current.revision + 1,
      updated_at: now,
      timeline: [
        ...current.timeline,
        {
          schema_version: '1.0.0',
          event_id: `${caseId}-REVIEWER_DECISION`,
          case_id: caseId,
          timestamp: now,
          type: 'REVIEWER_DECISION',
          actor_id: 'DEMO_REVIEWER',
          message: input.note,
        },
      ],
    };
    const saved = await repositories!.cases.update(next, current.revision);
    await completeReservation(idempotency!, reservationInput, saved, caseId);
    return reply(200, assertValid('DecisionResponse', envelope(id, saved)), id);
  } catch (error) {
    await failReservation(idempotency!, reservationInput);
    if (error instanceof RepositoryConflictError)
      return failure(409, id, 'REVISION_CONFLICT', 'Case revision has changed.');
    return failure(500, id, 'INTERNAL_ERROR', 'Decision could not be persisted.', true);
  }
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const id = resolveCorrelationId(header(event, 'x-correlation-id'));
  if (!repositories || !idempotency)
    return failure(500, id, 'INTERNAL_ERROR', 'Operations service is not configured.', true);
  const method = event.httpMethod;
  const resource = event.resource;
  try {
    if (method === 'GET' && resource === '/v1/cases') return listCases(event, id);
    if (method === 'GET' && resource === '/v1/dashboard/summary') return dashboard(id);
    if (method === 'GET' && resource === '/v1/cases/{case_id}') {
      const value = await repositories.cases.get(pathId(event, 'case_id') ?? '');
      return value
        ? reply(200, assertValid('CaseResponse', envelope(id, value)), id)
        : failure(404, id, 'NOT_FOUND', 'Case was not found.');
    }
    if (method === 'GET' && resource === '/v1/sellers/{seller_id}') {
      const value = await repositories.sellers.get(pathId(event, 'seller_id') ?? '');
      return value
        ? reply(200, assertValid('SellerResponse', envelope(id, value)), id)
        : failure(404, id, 'NOT_FOUND', 'Seller was not found.');
    }
    if (method === 'POST' && resource === '/v1/cases/{case_id}/decision')
      return decide(event, id, pathId(event, 'case_id') ?? '');
    return failure(404, id, 'NOT_FOUND', 'Route was not found.');
  } catch {
    return failure(500, id, 'INTERNAL_ERROR', 'Operations request failed.', true);
  }
}

export default handler;
