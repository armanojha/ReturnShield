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
      method: 'GET',
      headers: { accept: 'application/json', 'x-correlation-id': correlationId },
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

export const apiClient = { getHealth, baseUrl };
