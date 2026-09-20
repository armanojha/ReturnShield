/**
 * Thin TypeScript surface over the frozen Phase 00 API contracts.
 *
 * These declarations are deliberately narrow: they mirror the frozen schema and
 * never widen, relax or reinterpret it. Runtime authority always belongs to the
 * generated validators in `validate.ts`, which are compiled from
 * `contracts/api/http.schema.json` itself. Contract tests assert that the
 * shapes below are accepted and that near-miss shapes are rejected, so drift
 * between these types and the frozen schema fails the build.
 */

/** Every v1 envelope carries this exact schema version. */
export const SCHEMA_VERSION = '1.0.0';
export type SchemaVersion = typeof SCHEMA_VERSION;

/** Logical service identifier used in health responses and structured logs. */
export const SERVICE_NAME = 'returnshield';
export type ServiceName = typeof SERVICE_NAME;

/**
 * `^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$` — shared by correlation IDs and every
 * entity identifier in the frozen contracts.
 */
export const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;

/** Error codes frozen in http.schema.json#/$defs/Error. */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'IDEMPOTENCY_CONFLICT'
  | 'REQUEST_IN_PROGRESS'
  | 'REVISION_CONFLICT'
  | 'INVALID_STATE'
  | 'ERROR_MISSING_CONTEXT'
  | 'AI_UNAVAILABLE'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export interface ErrorDetail {
  field: string;
  message: string;
}

export interface ApiErrorEnvelope {
  schema_version: SchemaVersion;
  correlation_id: string;
  error: {
    code: ErrorCode;
    message: string;
    retryable: boolean;
    /** Required by the frozen schema; use `[]` when there is nothing to add. */
    details: ErrorDetail[];
  };
}

export interface HealthResponse {
  schema_version: SchemaVersion;
  correlation_id: string;
  data: {
    service: ServiceName;
    status: 'ok';
  };
}

/** Named `$defs` in the frozen HTTP contract that have runtime validators. */
export type HttpDefinitionName =
  | 'Error'
  | 'HealthResponse'
  | 'ListingRequest'
  | 'ListingResponse'
  | 'ReturnRequest'
  | 'ReturnResponse'
  | 'CaseResponse'
  | 'SellerResponse'
  | 'CaseQuery'
  | 'CasesResponse'
  | 'DashboardResponse'
  | 'DecisionRequest'
  | 'DecisionResponse';

/**
 * Named `$defs` in the additive Phase 07A image contract
 * (`contracts/api/image.schema.json`, task P7A-CON-01). Separate from
 * `HttpDefinitionName` so the frozen Phase 00 definition list above is
 * never touched by this sidecar bundle.
 */
export type ImageHttpDefinitionName =
  | 'ImageUploadRequest'
  | 'ImageUploadResponse'
  | 'ImageCompleteRequest'
  | 'ImageEvidenceResponse'
  | 'ImageDownloadResponse'
  | 'ImageListResponse';

/** Named entity definitions in the frozen data contract. */
export type EntityDefinitionName =
  | 'Evidence'
  | 'Seller'
  | 'Listing'
  | 'Customer'
  | 'Order'
  | 'TimelineEntry'
  | 'ReviewerDisposition'
  | 'RiskEvent'
  | 'ReturnCase';

/**
 * Named entity definitions in the additive Phase 07A image-entities
 * contract (`contracts/data/image-entities.schema.json`, task P7A-CON-01).
 */
export type ImageEntityDefinitionName = 'ImageEvidence';

/**
 * Named `$defs` in the frozen `contracts/ai/models.schema.json` contract.
 * Phase 03 (task P3-AI-02) validates raw Bedrock output against
 * `ListingGuardOutput` before it is trusted; `ListingGuardInput` is available
 * for symmetry even though Phase 03 builds the prompt directly rather than
 * validating its own input shape at runtime.
 */
export type AiDefinitionName =
  | 'ListingGuardInput'
  | 'ListingGuardOutput'
  | 'InvestigatorInput'
  | 'InvestigatorOutput'
  | 'ReviewEvent';

/**
 * Named `$defs` in the additive Phase 07A image-analysis AI contract
 * (`contracts/ai/image-models.schema.json`, task P7A-CON-01). Raw Bedrock
 * `amazon.nova-lite-v1:0` output is validated against `ImageAnalysisOutput`
 * before it is ever trusted or persisted, exactly as `ListingGuardOutput`
 * is validated above — see `services/image-analysis`.
 */
export type ImageAiDefinitionName = 'ImageAnalysisOutput';
