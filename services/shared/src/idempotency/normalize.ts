/**
 * Payload normalization and hashing, exactly as frozen in
 * `contracts/api/semantics.md`: "parsed JSON with recursively sorted object
 * keys, preserving array order and exact string contents; compute SHA-256
 * of its UTF-8 compact serialization including schema_version."
 *
 * Callers must pass the full parsed request body (which the frozen HTTP
 * contracts require to include `schema_version`) — this module does not
 * add it. It does not re-parse JSON text; it works on the already-parsed
 * value, so array order and string contents are exactly what the caller
 * passed, satisfying "preserving array order and exact string contents."
 */
import { createHash } from 'node:crypto';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      sorted[key] = sortKeysDeep(source[key]);
    }
    return sorted;
  }
  return value;
}

/** Compact, deterministic serialization of `payload` for hashing/comparison. */
export function normalizeForHash(payload: unknown): string {
  assertJsonValue(payload, '$');
  if (
    payload === null ||
    typeof payload !== 'object' ||
    Array.isArray(payload) ||
    (payload as Record<string, unknown>).schema_version === undefined
  ) {
    throw new TypeError('Idempotency payload must be a JSON object containing schema_version');
  }
  return JSON.stringify(sortKeysDeep(payload) as JsonValue);
}

/** SHA-256 hex digest of the normalized, compact UTF-8 serialization. */
export function hashPayload(payload: unknown): string {
  return createHash('sha256').update(normalizeForHash(payload), 'utf8').digest('hex');
}

/** True when two payloads normalize to the same hash (used only in tests/debugging). */
export function payloadsMatch(a: unknown, b: unknown): boolean {
  return hashPayload(a) === hashPayload(b);
}

function assertJsonValue(value: unknown, path: string): asserts value is JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`${path} contains a non-finite number`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((child, index) => assertJsonValue(child, `${path}[${index}]`));
    return;
  }
  if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    for (const [key, child] of Object.entries(value as Record<string, unknown>))
      assertJsonValue(child, `${path}.${key}`);
    return;
  }
  throw new TypeError(`${path} is not valid JSON data`);
}
