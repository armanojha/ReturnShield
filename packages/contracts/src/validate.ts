import Ajv2020 from 'ajv/dist/2020.js';
import type { ErrorObject, ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';

import {
  aiImageModelsSchema,
  aiModelsSchema,
  apiHttpSchema,
  apiImageSchema,
  dataEntitiesSchema,
  dataImageEntitiesSchema,
  riskEvaluationSchema,
} from './generated/schemas.js';
import type {
  AiDefinitionName,
  ApiErrorEnvelope,
  EntityDefinitionName,
  HealthResponse,
  HttpDefinitionName,
  ImageAiDefinitionName,
  ImageEntityDefinitionName,
  ImageHttpDefinitionName,
} from './types.js';

const HTTP_SCHEMA_ID = 'https://returnshield.example/contracts/api/http.schema.json';
const ENTITY_SCHEMA_ID = 'https://returnshield.example/contracts/data/entities.schema.json';
const AI_SCHEMA_ID = 'https://returnshield.example/contracts/ai/models.schema.json';
const IMAGE_HTTP_SCHEMA_ID = 'https://returnshield.example/contracts/api/image.schema.json';
const IMAGE_ENTITY_SCHEMA_ID =
  'https://returnshield.example/contracts/data/image-entities.schema.json';
const IMAGE_AI_SCHEMA_ID = 'https://returnshield.example/contracts/ai/image-models.schema.json';

/**
 * One Ajv instance holding every frozen bundle PLUS the additive Phase 07A
 * image sidecar bundle (task P7A-CON-01), so cross-bundle `$ref`s (image
 * entities referencing `ImageAnalysisOutput`, image HTTP envelopes
 * referencing `ImageEvidence`) resolve entirely offline. Adding the image
 * schemas here never edits or reinterprets a frozen Phase 00 `$def` — they
 * are new `$id`s, added alongside the frozen ones.
 */
function createAjv(): Ajv2020 {
  const ajv = new Ajv2020({
    strict: false,
    allErrors: true,
    allowUnionTypes: true,
  });
  addFormats(ajv);
  ajv.addSchema([
    apiHttpSchema,
    dataEntitiesSchema,
    riskEvaluationSchema,
    aiModelsSchema,
    apiImageSchema,
    dataImageEntitiesSchema,
    aiImageModelsSchema,
  ]);
  return ajv;
}

const ajv = createAjv();
const cache = new Map<HttpDefinitionName, ValidateFunction>();
const entityCache = new Map<EntityDefinitionName, ValidateFunction>();
const aiCache = new Map<AiDefinitionName, ValidateFunction>();
const imageHttpCache = new Map<ImageHttpDefinitionName, ValidateFunction>();
const imageEntityCache = new Map<ImageEntityDefinitionName, ValidateFunction>();
const imageAiCache = new Map<ImageAiDefinitionName, ValidateFunction>();

/** Compiled validator for a named `$def` of the frozen HTTP contract. */
export function getHttpValidator(name: HttpDefinitionName): ValidateFunction {
  const cached = cache.get(name);
  if (cached) return cached;

  const validator = ajv.getSchema(`${HTTP_SCHEMA_ID}#/$defs/${name}`);
  if (!validator) {
    throw new Error(`Frozen contract has no definition named "${name}"`);
  }
  cache.set(name, validator);
  return validator;
}

/** Compiled validator for a named `$def` of the frozen entity contract. */
export function getEntityValidator(name: EntityDefinitionName): ValidateFunction {
  const cached = entityCache.get(name);
  if (cached) return cached;
  const validator = ajv.getSchema(`${ENTITY_SCHEMA_ID}#/$defs/${name}`);
  if (!validator) throw new Error(`Frozen contract has no entity definition named "${name}"`);
  entityCache.set(name, validator);
  return validator;
}

export function validateEntity<T>(
  name: EntityDefinitionName,
  payload: unknown,
): ValidationResult<T> {
  const validator = getEntityValidator(name);
  const valid = validator(payload);
  return valid
    ? { valid: true, value: payload as T, errors: [] }
    : { valid: false, errors: formatValidationErrors(validator.errors) };
}

export function assertValidEntity<T>(name: EntityDefinitionName, payload: unknown): T {
  const result = validateEntity<T>(name, payload);
  if (!result.valid || result.value === undefined) {
    throw new ContractViolationError(name, result.errors);
  }
  return result.value;
}

/**
 * Compiled validator for a named `$def` of the frozen AI contract
 * (`contracts/ai/models.schema.json`). Added for Phase 03 (task P3-AI-02):
 * raw Bedrock output must be validated against `ListingGuardOutput` before
 * it is trusted — never persisted, and never silently accepted, on failure.
 */
export function getAiValidator(name: AiDefinitionName): ValidateFunction {
  const cached = aiCache.get(name);
  if (cached) return cached;
  const validator = ajv.getSchema(`${AI_SCHEMA_ID}#/$defs/${name}`);
  if (!validator) throw new Error(`Frozen contract has no AI definition named "${name}"`);
  aiCache.set(name, validator);
  return validator;
}

export function validateAiOutput<T>(name: AiDefinitionName, payload: unknown): ValidationResult<T> {
  const validator = getAiValidator(name);
  const valid = validator(payload);
  return valid
    ? { valid: true, value: payload as T, errors: [] }
    : { valid: false, errors: formatValidationErrors(validator.errors) };
}

/** Validates and narrows, or throws `ContractViolationError`, against the frozen AI contract. */
export function assertValidAiOutput<T>(name: AiDefinitionName, payload: unknown): T {
  const result = validateAiOutput<T>(name, payload);
  if (!result.valid || result.value === undefined) {
    throw new ContractViolationError(name, result.errors);
  }
  return result.value;
}

/** Compiled validator for a named `$def` of the additive Phase 07A image contract. */
export function getImageHttpValidator(name: ImageHttpDefinitionName): ValidateFunction {
  const cached = imageHttpCache.get(name);
  if (cached) return cached;
  const validator = ajv.getSchema(`${IMAGE_HTTP_SCHEMA_ID}#/$defs/${name}`);
  if (!validator) throw new Error(`Image contract has no definition named "${name}"`);
  imageHttpCache.set(name, validator);
  return validator;
}

export function validateImageAgainst<T>(
  name: ImageHttpDefinitionName,
  payload: unknown,
): ValidationResult<T> {
  const validator = getImageHttpValidator(name);
  const valid = validator(payload);
  return valid
    ? { valid: true, value: payload as T, errors: [] }
    : { valid: false, errors: formatValidationErrors(validator.errors) };
}

export function assertValidImage<T>(name: ImageHttpDefinitionName, payload: unknown): T {
  const result = validateImageAgainst<T>(name, payload);
  if (!result.valid || result.value === undefined) {
    throw new ContractViolationError(name, result.errors);
  }
  return result.value;
}

/** Compiled validator for a named `$def` of the additive Phase 07A `ImageEvidence` entity. */
export function getImageEntityValidator(name: ImageEntityDefinitionName): ValidateFunction {
  const cached = imageEntityCache.get(name);
  if (cached) return cached;
  const validator = ajv.getSchema(`${IMAGE_ENTITY_SCHEMA_ID}#/$defs/${name}`);
  if (!validator) throw new Error(`Image contract has no entity definition named "${name}"`);
  imageEntityCache.set(name, validator);
  return validator;
}

export function validateImageEntity<T>(
  name: ImageEntityDefinitionName,
  payload: unknown,
): ValidationResult<T> {
  const validator = getImageEntityValidator(name);
  const valid = validator(payload);
  return valid
    ? { valid: true, value: payload as T, errors: [] }
    : { valid: false, errors: formatValidationErrors(validator.errors) };
}

export function assertValidImageEntity<T>(name: ImageEntityDefinitionName, payload: unknown): T {
  const result = validateImageEntity<T>(name, payload);
  if (!result.valid || result.value === undefined) {
    throw new ContractViolationError(name, result.errors);
  }
  return result.value;
}

/**
 * Compiled validator for `ImageAnalysisOutput` — raw `amazon.nova-lite-v1:0`
 * Bedrock Converse output is untrusted until it passes this validator (task
 * P7A-AI-01), mirroring `getAiValidator`/`assertValidAiOutput` above.
 */
export function getImageAiValidator(name: ImageAiDefinitionName): ValidateFunction {
  const cached = imageAiCache.get(name);
  if (cached) return cached;
  const validator = ajv.getSchema(`${IMAGE_AI_SCHEMA_ID}#/$defs/${name}`);
  if (!validator) throw new Error(`Image contract has no AI definition named "${name}"`);
  imageAiCache.set(name, validator);
  return validator;
}

export function validateImageAiOutput<T>(
  name: ImageAiDefinitionName,
  payload: unknown,
): ValidationResult<T> {
  const validator = getImageAiValidator(name);
  const valid = validator(payload);
  return valid
    ? { valid: true, value: payload as T, errors: [] }
    : { valid: false, errors: formatValidationErrors(validator.errors) };
}

export function assertValidImageAiOutput<T>(name: ImageAiDefinitionName, payload: unknown): T {
  const result = validateImageAiOutput<T>(name, payload);
  if (!result.valid || result.value === undefined) {
    throw new ContractViolationError(name, result.errors);
  }
  return result.value;
}

/** Human-readable, log-safe rendering of Ajv errors. Never includes payload values. */
export function formatValidationErrors(errors: ErrorObject[] | null | undefined): string[] {
  if (!errors || errors.length === 0) return [];
  return errors.map((error) => `${error.instancePath || '/'} ${error.message ?? 'is invalid'}`);
}

export interface ValidationResult<T> {
  valid: boolean;
  value?: T;
  errors: string[];
}

/** Validates `payload` against a frozen definition without throwing. */
export function validateAgainst<T>(name: HttpDefinitionName, payload: unknown): ValidationResult<T> {
  const validator = getHttpValidator(name);
  const valid = validator(payload);
  if (valid) {
    return { valid: true, value: payload as T, errors: [] };
  }
  return { valid: false, errors: formatValidationErrors(validator.errors) };
}

export class ContractViolationError extends Error {
  public readonly definition:
    | HttpDefinitionName
    | EntityDefinitionName
    | AiDefinitionName
    | ImageHttpDefinitionName
    | ImageEntityDefinitionName
    | ImageAiDefinitionName;
  public readonly violations: string[];

  constructor(
    definition:
      | HttpDefinitionName
      | EntityDefinitionName
      | AiDefinitionName
      | ImageHttpDefinitionName
      | ImageEntityDefinitionName
      | ImageAiDefinitionName,
    violations: string[],
  ) {
    super(`Payload does not satisfy frozen contract "${definition}": ${violations.join('; ')}`);
    this.name = 'ContractViolationError';
    this.definition = definition;
    this.violations = violations;
  }
}

/** Validates and narrows, or throws `ContractViolationError`. */
export function assertValid<T>(name: HttpDefinitionName, payload: unknown): T {
  const result = validateAgainst<T>(name, payload);
  if (!result.valid || result.value === undefined) {
    throw new ContractViolationError(name, result.errors);
  }
  return result.value;
}

export function isHealthResponse(payload: unknown): payload is HealthResponse {
  return validateAgainst<HealthResponse>('HealthResponse', payload).valid;
}

export function isApiErrorEnvelope(payload: unknown): payload is ApiErrorEnvelope {
  return validateAgainst<ApiErrorEnvelope>('Error', payload).valid;
}
