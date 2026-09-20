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
  CaseQuery,
  CaseResponse,
  CasesResponse,
  DashboardResponse,
  DecisionRequest,
  DecisionResponse,
  ImageDownloadResponse,
  ImageListResponse,
  ListingRequest,
  ListingResponse,
  ReturnRequest,
  ReturnResponse,
  SellerResponse,
} from './types';

export type {
  CaseQuery,
  CaseResponse,
  CasesResponse,
  DashboardResponse,
  DecisionRequest,
  DecisionResponse,
  Evidence,
  ImageEvidence,
  InvestigatorFactor,
  InvestigatorOutput,
  Listing,
  ListingEvidence,
  ListingGuardOutput,
  ListingIssue,
  ListingRequest,
  ListingResponse,
  ReturnCase,
  ReturnReason,
  ReturnRequest,
  ReturnResponse,
  Seller,
} from './types';

export interface RequestOptions {
  signal?: AbortSignal;

  method?: 'GET' | 'POST';

  body?: unknown;

  headers?: Record<string, string>;

  query?: Record<
    string,
    string | number | boolean | null | undefined
  >;
}

const DEFAULT_TIMEOUT_MS = 12000;

export class ApiError extends Error {
  public readonly kind:
    | 'network'
    | 'timeout'
    | 'http'
    | 'contract';

  public readonly status?: number;
  public readonly code?: ErrorCode;
  public readonly correlationId?: string;
  public readonly retryable: boolean;

  constructor(
    kind: ApiError['kind'],
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
    if (options.status !== undefined) {
      this.status = options.status;
    }
    if (options.code !== undefined) {
      this.code = options.code;
    }
    if (options.correlationId !== undefined) {
      this.correlationId = options.correlationId;
    }

    this.retryable =
      options.retryable ??
      kind !== 'contract';
  }
}

function baseUrl(): string {
  return String(
    import.meta.env.VITE_API_BASE_URL ?? '',
  ).replace(/\/+$/, '');
}

function timeoutMs(): number {
  const value = Number(
    import.meta.env.VITE_API_TIMEOUT_MS,
  );

  return Number.isFinite(value) && value > 0
    ? value
    : DEFAULT_TIMEOUT_MS;
}

function buildUrl(
  path: string,
  query?: RequestOptions['query'],
): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(
    query ?? {},
  )) {
    if (
      value === undefined ||
      value === null ||
      value === ''
    ) {
      continue;
    }

    params.set(key, String(value));
  }

  const queryString = params.toString();

  return `${baseUrl()}${path}${
    queryString ? `?${queryString}` : ''
  }`;
}

async function request<T>(
  path: string,
  definition:
    | HttpDefinitionName
    | ImageHttpDefinitionName,
  options: RequestOptions = {},
): Promise<T> {
  const correlationId =
    newCorrelationId();

  const controller =
    new AbortController();

  const deadline = setTimeout(
    () => controller.abort(),
    timeoutMs(),
  );

  const abortFromCaller = () =>
    controller.abort();

  options.signal?.addEventListener(
    'abort',
    abortFromCaller,
  );

  let response: Response;

  try {
    response = await fetch(
      buildUrl(path, options.query),
      {
        method:
          options.method ?? 'GET',

        headers: {
          accept: 'application/json',

          'x-correlation-id':
            correlationId,

          ...(options.body === undefined
            ? {}
            : {
                'content-type':
                  'application/json',
              }),

          ...(options.headers ?? {}),
        },

        ...(options.body === undefined
          ? {}
          : {
              body: JSON.stringify(
                options.body,
              ),
            }),

        signal: controller.signal,
      },
    );
  } catch (cause) {
    const timedOut =
      cause instanceof DOMException &&
      cause.name === 'AbortError';

    throw new ApiError(
      timedOut ? 'timeout' : 'network',

      timedOut
        ? 'The service did not respond in time.'
        : 'The service could not be reached.',

      {
        correlationId,
      },
    );
  } finally {
    clearTimeout(deadline);

    options.signal?.removeEventListener(
      'abort',
      abortFromCaller,
    );
  }

  let payload: unknown;

  try {
    payload =
      await response.json();
  } catch {
    throw new ApiError(
      'contract',
      'The service returned invalid JSON.',
      {
        status: response.status,
        correlationId,
      },
    );
  }

  if (!response.ok) {
    if (
      isApiErrorEnvelope(payload)
    ) {
      throw new ApiError(
        'http',
        payload.error.message,
        {
          status: response.status,
          code: payload.error.code,
          correlationId:
            payload.correlation_id,
          retryable:
            payload.error.retryable,
        },
      );
    }

    throw new ApiError(
      'http',
      `Request failed (${response.status}).`,
      {
        status: response.status,
        correlationId,
      },
    );
  }

  try {
    if (
      definition.startsWith('Image')
    ) {
      return assertValidImage<T>(
        definition as ImageHttpDefinitionName,
        payload,
      );
    }

    return assertValid<T>(
      definition as HttpDefinitionName,
      payload,
    );
  } catch (cause) {
    if (
      cause instanceof
      ContractViolationError
    ) {
      throw new ApiError(
        'contract',
        'The service returned data that failed validation.',
        {
          status: response.status,
          correlationId,
        },
      );
    }

    throw cause;
  }
}

export function getHealth(
  options: RequestOptions = {},
): Promise<HealthResponse> {
  return request<HealthResponse>(
    '/v1/health',
    'HealthResponse',
    options,
  );
}

export function analyzeListing(
  input: ListingRequest,
  idempotencyKey = newCorrelationId(),
): Promise<ListingResponse> {
  return request<ListingResponse>(
    '/v1/listings/analyze',
    'ListingResponse',
    {
      method: 'POST',

      body: input,

      headers: {
        'idempotency-key':
          idempotencyKey,
      },
    },
  );
}

export function getListing(
  listingId: string,
): Promise<ListingResponse> {
  return request<ListingResponse>(
    `/v1/listings/${encodeURIComponent(
      listingId,
    )}`,
    'ListingResponse',
  );
}

export function createReturn(
  input: ReturnRequest,
  idempotencyKey = newCorrelationId(),
): Promise<ReturnResponse> {
  return request<ReturnResponse>(
    '/v1/returns',
    'ReturnResponse',
    {
      method: 'POST',

      body: input,

      headers: {
        'idempotency-key':
          idempotencyKey,
      },
    },
  );
}

export function getCases(
  query: CaseQuery = {},
): Promise<CasesResponse> {
  return request<CasesResponse>(
    '/v1/cases',
    'CasesResponse',
    {
      query: query as Record<string, string | number | boolean | null | undefined>,
    },
  );
}

export function getCase(
  caseId: string,
): Promise<CaseResponse> {
  return request<CaseResponse>(
    `/v1/cases/${encodeURIComponent(
      caseId,
    )}`,
    'CaseResponse',
  );
}

export function getSeller(
  sellerId: string,
): Promise<SellerResponse> {
  return request<SellerResponse>(
    `/v1/sellers/${encodeURIComponent(
      sellerId,
    )}`,
    'SellerResponse',
  );
}

export function getDashboard(): Promise<DashboardResponse> {
  return request<DashboardResponse>(
    '/v1/dashboard/summary',
    'DashboardResponse',
  );
}

export function postDecision(
  caseId: string,
  input: Omit<
    DecisionRequest,
    'schema_version'
  >,
  idempotencyKey = newCorrelationId(),
): Promise<DecisionResponse> {
  return request<DecisionResponse>(
    `/v1/cases/${encodeURIComponent(
      caseId,
    )}/decision`,
    'DecisionResponse',
    {
      method: 'POST',

      body: {
        schema_version: '1.0.0',
        ...input,
      },

      headers: {
        'idempotency-key':
          idempotencyKey,
      },
    },
  );
}

export function getCaseImages(
  caseId: string,
): Promise<ImageListResponse> {
  return request<ImageListResponse>(
    `/v1/cases/${encodeURIComponent(
      caseId,
    )}/images`,
    'ImageListResponse',
  );
}

export function getListingImages(
  listingId: string,
): Promise<ImageListResponse> {
  return request<ImageListResponse>(
    `/v1/listings/${encodeURIComponent(
      listingId,
    )}/images`,
    'ImageListResponse',
  );
}

export function getImageDownload(
  imageId: string,
): Promise<ImageDownloadResponse> {
  return request<ImageDownloadResponse>(
    `/v1/images/${encodeURIComponent(
      imageId,
    )}/download`,
    'ImageDownloadResponse',
  );
}

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
