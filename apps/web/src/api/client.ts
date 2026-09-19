import {
  newCorrelationId,
} from '@returnshield/contracts';

import type {
  ApiEnvelope,
  ApiErrorBody,
  CaseListResponse,
  CaseResponse,
  CaseSummary,
  DashboardResponse,
  HealthResponse,
  ListingAnalyzeRequest,
  ListingResponse,
  ReviewerDecision,
  SellerResponse,
} from './types';

const DEFAULT_TIMEOUT_MS = 10000;

function getBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL ?? '';

  return configured.replace(/\/+$/, '');
}

function getTimeout(): number {
  const configured = Number(
    import.meta.env.VITE_API_TIMEOUT_MS,
  );

  if (
    Number.isFinite(configured) &&
    configured > 0
  ) {
    return configured;
  }

  return DEFAULT_TIMEOUT_MS;
}

export type ApiFailureKind =
  | 'network'
  | 'timeout'
  | 'http'
  | 'contract';

export class ApiError extends Error {
  readonly kind: ApiFailureKind;
  readonly status?: number | undefined;
  readonly correlationId?: string | undefined;
  readonly retryable: boolean;

  constructor(
    kind: ApiFailureKind,
    message: string,
    options: {
      status?: number | undefined;
      correlationId?: string | undefined;
      retryable?: boolean | undefined;
    } = {},
  ) {
    super(message);

    this.name = 'ApiError';
    this.kind = kind;
    this.status = options.status;
    this.correlationId = options.correlationId;

    this.retryable =
      options.retryable ??
      kind !== 'contract';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  signal?: AbortSignal;
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null
  );
}

function isEnvelope<T>(
  value: unknown,
): value is ApiEnvelope<T> {
  return (
    isRecord(value) &&
    'data' in value
  );
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const correlationId =
    newCorrelationId();

  const controller =
    new AbortController();

  const timeout = window.setTimeout(
    () => controller.abort(),
    getTimeout(),
  );

  const abortFromCaller = () => {
    controller.abort();
  };

  options.signal?.addEventListener(
    'abort',
    abortFromCaller,
  );

  let response: Response;

  try {
    response = await fetch(
      `${getBaseUrl()}${path}`,
      {
        method:
          options.method ?? 'GET',

        headers: {
          Accept:
            'application/json',

          'Content-Type':
            'application/json',

          'x-correlation-id':
            correlationId,
        },

        ...(options.body !== undefined
          ? {
              body: JSON.stringify(
                options.body,
              ),
            }
          : {}),

        signal: controller.signal,
      },
    );
  } catch (error) {
    const aborted =
      error instanceof DOMException &&
      error.name === 'AbortError';

    throw new ApiError(
      aborted
        ? 'timeout'
        : 'network',

      aborted
        ? 'The API request timed out.'
        : 'The ReturnShield API could not be reached.',

      {
        correlationId,
      },
    );
  } finally {
    window.clearTimeout(timeout);

    options.signal?.removeEventListener(
      'abort',
      abortFromCaller,
    );
  }

  let payload: unknown;

  try {
    payload =
      response.status === 204
        ? null
        : await response.json();
  } catch {
    throw new ApiError(
      'contract',
      'The API returned invalid JSON.',
      {
        status: response.status,
        correlationId,
      },
    );
  }

  if (!response.ok) {
    const body =
      payload as ApiErrorBody | null;

    throw new ApiError(
      'http',
      body?.error?.message ??
        `Request failed with HTTP ${response.status}.`,
      {
        status: response.status,
        correlationId:
          body?.correlation_id ??
          correlationId,
        retryable:
          body?.error?.retryable ??
          response.status >= 500,
      },
    );
  }

  return payload as T;
}

function unwrap<T>(
  payload: T | ApiEnvelope<T>,
): T {
  if (isEnvelope<T>(payload)) {
    return payload.data;
  }

  return payload as T;
}

export async function getHealth(): Promise<HealthResponse> {
  const response =
    await request<HealthResponse>(
      '/v1/health',
    );

  return response;
}

export async function getDashboardSummary(): Promise<DashboardResponse> {
  const response =
    await request<
      DashboardResponse
    >(
      '/v1/dashboard/summary',
    );

  return response;
}

export async function getCases(): Promise<CaseListResponse> {
  const response =
    await request<
      CaseListResponse | CaseSummary[]
    >(
      '/v1/cases',
    );

  if (Array.isArray(response)) {
    return {
      data: response,
    };
  }

  return response;
}

export async function getCase(
  caseId: string,
): Promise<CaseResponse> {
  const response =
    await request<
      CaseResponse
    >(
      `/v1/cases/${encodeURIComponent(
        caseId,
      )}`,
    );

  return response;
}

export async function getListing(
  listingId: string,
): Promise<ListingResponse> {
  return request<ListingResponse>(
    `/v1/listings/${encodeURIComponent(
      listingId,
    )}`,
  );
}

export async function getSeller(
  sellerId: string,
): Promise<SellerResponse> {
  return request<SellerResponse>(
    `/v1/sellers/${encodeURIComponent(
      sellerId,
    )}`,
  );
}

export async function analyzeListing(
  input: ListingAnalyzeRequest,
): Promise<ListingResponse> {
  return request<ListingResponse>(
    '/v1/listings/analyze',
    {
      method: 'POST',

      body: input,
    },
  );
}

export async function submitReviewerDecision(
  caseId: string,
  decision: ReviewerDecision,
): Promise<CaseResponse> {
  return request<CaseResponse>(
    `/v1/cases/${encodeURIComponent(
      caseId,
    )}/decision`,
    {
      method: 'POST',

      body: {
        decision,
      },
    },
  );
}

export {
  unwrap,
  getBaseUrl,
};
