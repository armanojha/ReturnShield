import {
  ContractViolationError,
  assertValid,
  assertValidImage,
  isApiErrorEnvelope,
  newCorrelationId,
} from '@returnshield/contracts';
import type {
  ErrorCode,
  HealthResponse,
  HttpDefinitionName,
  ImageHttpDefinitionName,
} from '@returnshield/contracts';
import type {
  CaseResponse,
  CasesResponse,
  DashboardResponse,
  DecisionResponse,
  ImageDownloadResponse,
  ImageListResponse,
  ListingResponse,
  ReturnResponse,
  SellerResponse,
} from './types';
export type { ListingResponse, ReturnCase, Listing, Seller, ImageEvidence } from './types';

export interface ListingRequest {
  schema_version: '1.0.0';
  listing_id: string;
  seller_id: string;
  title: string;
  description: string;
  category: 'APPAREL' | 'ELECTRONICS' | 'HOME';
}
export class ApiError extends Error {
  constructor(
    public readonly kind: 'network' | 'timeout' | 'http' | 'contract',
    message: string,
    public readonly options: {
      status?: number;
      code?: ErrorCode;
      correlationId?: string;
      retryable?: boolean;
    } = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
  get status() {
    return this.options.status;
  }
  get code() {
    return this.options.code;
  }
  get correlationId() {
    return this.options.correlationId;
  }
  get retryable() {
    return this.options.retryable ?? this.kind !== 'contract';
  }
}
interface RequestOptions {
  signal?: AbortSignal;
  method?: 'GET' | 'POST';
  body?: unknown;
  headers?: Record<string, string>;
  query?: Record<string, unknown>;
}
const DEFAULT_TIMEOUT_MS = 12000;
function baseUrl() {
  return String(import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');
}
function timeoutMs() {
  const n = Number(import.meta.env.VITE_API_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TIMEOUT_MS;
}
async function request<T>(
  path: string,
  definition: HttpDefinitionName | ImageHttpDefinitionName,
  options: RequestOptions = {},
): Promise<T> {
  const correlationId = newCorrelationId(),
    controller = new AbortController(),
    deadline = setTimeout(() => controller.abort(), timeoutMs()),
    abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort);
  const params = new URLSearchParams();
  Object.entries(options.query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  });
  let response: Response;
  try {
    response = await fetch(`${baseUrl()}${path}${params.size ? `?${params}` : ''}`, {
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
    const stopped = error instanceof DOMException && error.name === 'AbortError';
    throw new ApiError(
      stopped ? 'timeout' : 'network',
      stopped ? 'The service did not respond in time.' : 'The service could not be reached.',
      { correlationId },
    );
  } finally {
    clearTimeout(deadline);
    options.signal?.removeEventListener('abort', abort);
  }
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError('contract', 'The service returned invalid JSON.', {
      status: response.status,
      correlationId,
    });
  }
  if (!response.ok) {
    if (isApiErrorEnvelope(payload))
      throw new ApiError('http', payload.error.message, {
        status: response.status,
        code: payload.error.code,
        correlationId: payload.correlation_id,
        retryable: payload.error.retryable,
      });
    throw new ApiError('http', `Request failed (${response.status}).`, {
      status: response.status,
      correlationId,
    });
  }
  try {
    return definition.startsWith('Image')
      ? assertValidImage<T>(definition as ImageHttpDefinitionName, payload)
      : assertValid<T>(definition as HttpDefinitionName, payload);
  } catch (error) {
    if (error instanceof ContractViolationError)
      throw new ApiError('contract', 'The service returned data that failed validation.', {
        status: response.status,
        correlationId,
      });
    throw error;
  }
}
export const getHealth = (options: RequestOptions = {}) =>
  request<HealthResponse>('/v1/health', 'HealthResponse', options);
export const analyzeListing = (input: ListingRequest, key = newCorrelationId()) =>
  request<ListingResponse>('/v1/listings/analyze', 'ListingResponse', {
    method: 'POST',
    body: input,
    headers: { 'content-type': 'application/json', 'idempotency-key': key },
  });
export const getListing = (id: string) =>
  request<ListingResponse>(`/v1/listings/${encodeURIComponent(id)}`, 'ListingResponse');
export const createReturn = (input: unknown, key = newCorrelationId()) =>
  request<ReturnResponse>('/v1/returns', 'ReturnResponse', {
    method: 'POST',
    body: input,
    headers: { 'content-type': 'application/json', 'idempotency-key': key },
  });
export const getCases = (query: Record<string, unknown> = {}) =>
  request<CasesResponse>('/v1/cases', 'CasesResponse', { query });
export const getCase = (id: string) =>
  request<CaseResponse>(`/v1/cases/${encodeURIComponent(id)}`, 'CaseResponse');
export const getSeller = (id: string) =>
  request<SellerResponse>(`/v1/sellers/${encodeURIComponent(id)}`, 'SellerResponse');
export const getDashboard = () =>
  request<DashboardResponse>('/v1/dashboard/summary', 'DashboardResponse');
export const postDecision = (
  id: string,
  input: { action: 'APPROVE_RETURN' | 'DECLINE_RETURN'; note: string; expected_revision: number },
  key = newCorrelationId(),
) =>
  request<DecisionResponse>(`/v1/cases/${encodeURIComponent(id)}/decision`, 'DecisionResponse', {
    method: 'POST',
    body: { schema_version: '1.0.0', ...input },
    headers: { 'content-type': 'application/json', 'idempotency-key': key },
  });
export const getCaseImages = (id: string) =>
  request<ImageListResponse>(`/v1/cases/${encodeURIComponent(id)}/images`, 'ImageListResponse');
export const getListingImages = (id: string) =>
  request<ImageListResponse>(`/v1/listings/${encodeURIComponent(id)}/images`, 'ImageListResponse');
export const getImageDownload = (id: string) =>
  request<ImageDownloadResponse>(
    `/v1/images/${encodeURIComponent(id)}/download`,
    'ImageDownloadResponse',
  );
export const apiClient = {
  getHealth,
  analyzeListing,
  getListing,
  createReturn,
  getCases,
  getCase,
  getSeller,
  getDashboard,
  postDecision,
  getCaseImages,
  getListingImages,
  getImageDownload,
  baseUrl,
};
