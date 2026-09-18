import Ajv2020 from 'ajv/dist/2020.js';
import type { ErrorObject, ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';

import {
  aiModelsSchema,
  apiHttpSchema,
  dataEntitiesSchema,
  riskEvaluationSchema,
} from './generated/schemas.js';
import type {
  ApiErrorEnvelope,
  EntityDefinitionName,
  HealthResponse,
  HttpDefinitionName,
} from './types.js';

const HTTP_SCHEMA_ID = 'https://returnshield.example/contracts/api/http.schema.json';
const ENTITY_SCHEMA_ID = 'https://returnshield.example/contracts/data/entities.schema.json';

/**
 * One Ajv instance holding every frozen bundle, so cross-bundle `$ref`s
 * (HTTP envelopes referencing data entities) resolve entirely offline.
 */
function createAjv(): Ajv2020 {
  const ajv = new Ajv2020({
    strict: false,
    allErrors: true,
    allowUnionTypes: true,
  });
  addFormats(ajv);
  ajv.addSchema([apiHttpSchema, dataEntitiesSchema, riskEvaluationSchema, aiModelsSchema]);
  return ajv;
}

const ajv = createAjv();
const cache = new Map<HttpDefinitionName, ValidateFunction>();
const entityCache = new Map<EntityDefinitionName, ValidateFunction>();

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
  public readonly definition: HttpDefinitionName | EntityDefinitionName;
  public readonly violations: string[];

  constructor(definition: HttpDefinitionName | EntityDefinitionName, violations: string[]) {
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
