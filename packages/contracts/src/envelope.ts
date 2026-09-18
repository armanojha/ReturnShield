import { ID_PATTERN, SCHEMA_VERSION, SERVICE_NAME } from './types.js';
import type { ApiErrorEnvelope, ErrorCode, ErrorDetail, HealthResponse } from './types.js';

/** True when a candidate string satisfies the frozen ID/correlation pattern. */
export function isValidCorrelationId(value: unknown): value is string {
  return typeof value === 'string' && ID_PATTERN.test(value);
}

/**
 * Correlation IDs are server-generated per semantics.md. A caller-supplied value
 * is accepted only when it already satisfies the frozen pattern; anything else
 * is replaced rather than sanitised, so a malformed header can never shape an
 * identifier that later appears in logs.
 */
export function resolveCorrelationId(candidate?: unknown): string {
  return isValidCorrelationId(candidate) ? candidate : newCorrelationId();
}

/**
 * Universal generator: `globalThis.crypto` is available in Node 20 and in every
 * supported browser, so this module stays importable from both the Lambda and
 * the React application without a Node built-in dependency.
 */
export function newCorrelationId(): string {
  return globalThis.crypto.randomUUID();
}

/** Builds the frozen `HealthResponse` envelope. */
export function healthEnvelope(correlationId: string): HealthResponse {
  return {
    schema_version: SCHEMA_VERSION,
    correlation_id: correlationId,
    data: { service: SERVICE_NAME, status: 'ok' },
  };
}

/** Builds the frozen `Error` envelope. `details` is required by the schema. */
export function errorEnvelope(
  correlationId: string,
  code: ErrorCode,
  message: string,
  options: { retryable?: boolean; details?: ErrorDetail[] } = {},
): ApiErrorEnvelope {
  return {
    schema_version: SCHEMA_VERSION,
    correlation_id: correlationId,
    error: {
      code,
      message,
      retryable: options.retryable ?? false,
      details: options.details ?? [],
    },
  };
}
