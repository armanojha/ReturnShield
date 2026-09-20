/**
 * Shared API client for the React application (task P1-WEB-01).
 *
 * Every response is validated against the frozen Phase 00 schemas before it is
 * handed to a component, so a malformed or unexpected payload surfaces as an
 * explicit failure rather than as a partially-rendered success.
 */
import {
  ContractViolationError,
  assertValid,
  isApiErrorEnvelope,
  newCorrelationId,
} from '@returnshield/contracts';
import type { ErrorCode, HealthResponse, HttpDefinitionName } from '@returnshield/contracts';

export interface ListingRequest {
  schema_version: '1.0.0';
  listing_id: string;
  seller_id: string;
  title: string;
  description: string;
  category: 'APPAREL' | 'ELECTRONICS' | 'HOME';
}

export interface ListingResponse {
  schema_version: '1.0.0';
  correlation_id: string;
  data: {
    listing_id: string;
    seller_id: string;
    title: string;
    description: string;
    category: ListingRequest['category'];
    listing_risk: 'low' | 'medium' | 'high';
    status: 'PASS' | 'CORRECTION_REQUIRED';
    analysis: Record<string, unknown>;
    analysis_metadata: Record<string, unknown>;
    created_at: string;
  };
}

const DEFAULT_TIMEOUT_MS = 8000;

function baseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL ?? '';
  return configured.replace(/\/+$/, '');
}

function timeoutMs(): number {
  const configured = Number(import.meta.env.VITE_API_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TIMEOUT_MS;
}

/** Why a request failed, in terms a component can render without guessing. */
export type ApiFailureKind =
  | 'network' // the request never produced a response
  | 'timeout' // the request was aborted by the client deadline
  | 'http' // the service answered with a non-2xx status
  | 'contract'; // the body did not satisfy the frozen schema

export class ApiError extends Error {
  public readonly kind: ApiFailureKind;
  public readonly status?: number;
  public readonly code?: ErrorCode;
  public readonly correlationId?: string;
  public readonly retryable: boolean;

  constructor(
    kind: ApiFailureKind,
    message: string,
    options: {
      status?: number;
      code?: ErrorCode;
      correlationId?: string;
      retryable?: boolean;
    } = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.retryable = options.retryable ?? kind !== 'contract';
    if (options.status !== undefined) this.status = options.status;
    if (options.code !== undefined) this.code = options.code;
    if (options.correlationId !== undefined) this.correlationId = options.correlationId;
  }
}

interface RequestOptions {
  /** Allows a caller (or a test) to cancel an in-flight request. */
  signal?: AbortSignal;
  method?: 'GET' | 'POST';
  body?: unknown;
  headers?: Record<string, string>;
}

async function request<T>(
  path: string,
  definition: HttpDefinitionName,
  options: RequestOptions = {},
): Promise<T> {
  const correlationId = newCorrelationId();
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), timeoutMs());

  const abortFromCaller = () => controller.abort();
  options.signal?.addEventListener('abort', abortFromCaller);

  let response: Response;
  try {
    response = await fetch(`${baseUrl()}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        accept: 'application/json',
        'x-correlation-id': correlationId,
        ...(options.headers ?? {}),
      },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      signal: controller.signal,
    });
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === 'AbortError';
    throw new ApiError(
      aborted ? 'timeout' : 'network',
      aborted ? 'The service did not respond in time.' : 'The service could not be reached.',
      { correlationId },
    );
  } finally {
    clearTimeout(deadline);
    options.signal?.removeEventListener('abort', abortFromCaller);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError('contract', 'The service returned a response that was not valid JSON.', {
      status: response.status,
      correlationId,
    });
  }

  if (!response.ok) {
    if (isApiErrorEnvelope(payload)) {
      throw new ApiError('http', payload.error.message, {
        status: response.status,
        code: payload.error.code,
        correlationId: payload.correlation_id,
        retryable: payload.error.retryable,
      });
    }
    throw new ApiError('http', `The service responded with status ${response.status}.`, {
      status: response.status,
      correlationId,
    });
  }

  try {
    return assertValid<T>(definition, payload);
  } catch (error) {
    if (error instanceof ContractViolationError) {
      throw new ApiError('contract', 'The service returned a response that failed validation.', {
        status: response.status,
        correlationId,
      });
    }
    throw error;
  }
}

/** `GET /v1/health` — the only route wired in Phase 01. */
export function getHealth(options: RequestOptions = {}): Promise<HealthResponse> {
  return request<HealthResponse>('/v1/health', 'HealthResponse', options);
}

export function analyzeListing(
  input: ListingRequest,
  idempotencyKey = newCorrelationId(),
): Promise<ListingResponse> {
  return request<ListingResponse>('/v1/listings/analyze', 'ListingResponse', {
    method: 'POST',
    body: input,
    headers: { 'content-type': 'application/json', 'idempotency-key': idempotencyKey },
  });
}

export function getListing(listingId: string): Promise<ListingResponse> {
  return request<ListingResponse>(
    `/v1/listings/${encodeURIComponent(listingId)}`,
    'ListingResponse',
  );
}

export function getCases(query?: {
  limit?: number;
  cursor?: string;
  status?: 'PROCESSING' | 'DECIDED' | 'ERROR_MISSING_CONTEXT' | 'FAILED';
  priority?: 'NONE' | 'NORMAL' | 'HIGH';
  decision?: 'AUTO_APPROVE' | 'NEEDS_REVIEW';
  seller_id?: string;
  review_status?: 'OPEN' | 'RESOLVED';
}): Promise<CasesResponse> {
  return request<CasesResponse>('/v1/cases', 'CasesResponse', {
    method: 'GET',
    query,
  });
}

export function getCase(caseId: string): Promise<CaseResponse> {
  return request<CaseResponse>(`/v1/cases/${encodeURIComponent(caseId)}`, 'CaseResponse');
}

export function getSeller(sellerId: string): Promise<SellerResponse> {
  return request<SellerResponse>(`/v1/sellers/${encodeURIComponent(sellerId)}`, 'SellerResponse');
}

export function getDashboard(): Promise<DashboardResponse> {
  return request<DashboardResponse>('/v1/dashboard/summary', 'DashboardResponse');
}

export function postDecision(
  caseId: string,
  input: { action: 'APPROVE_RETURN' | 'DECLINE_RETURN'; note: string; expected_revision: number },
  idempotencyKey?: string,
): Promise<DecisionResponse> {
  return request<DecisionResponse>(
    `/v1/cases/${encodeURIComponent(caseId)}/decision`,
    'DecisionResponse',
    {
      method: 'POST',
      body: input,
      headers: {
        'content-type': 'application/json',
        'idempotency-key': idempotencyKey ?? newCorrelationId(),
      },
    },
  );
}

export const apiClient = {
  getHealth,
  analyzeListing,
  getListing,
  getCases,
  getCase,
  getSeller,
  getDashboard,
  postDecision,
  baseUrl,
};
