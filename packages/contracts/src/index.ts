/**
 * `@returnshield/contracts` — the single shared source of API truth for the
 * React application and every service.
 *
 * Nothing here re-authors the Phase 00 contracts. The validators are compiled
 * from the frozen JSON Schemas in `contracts`, mirrored by
 * `npm run sync:schemas`.
 */
export {
  ID_PATTERN,
  SCHEMA_VERSION,
  SERVICE_NAME,
  type ApiErrorEnvelope,
  type ErrorCode,
  type ErrorDetail,
  type EntityDefinitionName,
  type HealthResponse,
  type HttpDefinitionName,
  type SchemaVersion,
  type ServiceName,
} from './types.js';

export {
  ContractViolationError,
  assertValid,
  assertValidEntity,
  formatValidationErrors,
  getHttpValidator,
  getEntityValidator,
  isApiErrorEnvelope,
  isHealthResponse,
  validateAgainst,
  validateEntity,
  type ValidationResult,
} from './validate.js';

export {
  errorEnvelope,
  healthEnvelope,
  isValidCorrelationId,
  newCorrelationId,
  resolveCorrelationId,
} from './envelope.js';

export { CONTRACT_SOURCE_HASHES } from './generated/schemas.js';
