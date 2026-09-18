#!/usr/bin/env node
/**
 * Smoke check for `GET /v1/health`.
 *
 * Probes a real base URL and validates the response body against the frozen
 * Phase 00 `HealthResponse` schema. It has no fallback and no mock: if the
 * endpoint is unreachable or the body does not satisfy the contract, this exits
 * non-zero. A pass against a localhost URL is local evidence only and must not
 * be reported as deployment evidence.
 *
 * Usage:
 *   npm run build   # required once: the check imports the compiled contracts
 *   npm run smoke -- --url https://<api-id>.execute-api.<region>.amazonaws.com/dev
 *   SMOKE_BASE_URL=http://localhost:3001 npm run smoke
 */
import {
  assertValid,
  isValidCorrelationId,
  newCorrelationId,
} from '../packages/contracts/dist/index.js';

function argValue(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const baseUrl = (
  argValue('--url') ??
  process.env.SMOKE_BASE_URL ??
  'http://localhost:3001'
).replace(/\/+$/, '');
const target = `${baseUrl}/v1/health`;
const correlationId = newCorrelationId();
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS ?? 10_000);

function fail(reason) {
  console.error(`FAIL  ${target}`);
  console.error(`      ${reason}`);
  process.exit(1);
}

const controller = new AbortController();
const deadline = setTimeout(() => controller.abort(), timeoutMs);

let response;
const startedAt = Date.now();
try {
  response = await fetch(target, {
    headers: { accept: 'application/json', 'x-correlation-id': correlationId },
    signal: controller.signal,
  });
} catch (error) {
  fail(
    error?.name === 'AbortError'
      ? `no response within ${timeoutMs} ms`
      : `request failed: ${error?.message ?? 'unknown error'}`,
  );
} finally {
  clearTimeout(deadline);
}

const elapsedMs = Date.now() - startedAt;

if (response.status !== 200) {
  fail(`expected HTTP 200, received ${response.status}`);
}

let payload;
try {
  payload = await response.json();
} catch {
  fail('response body was not valid JSON');
}

try {
  assertValid('HealthResponse', payload);
} catch (error) {
  fail(`response did not satisfy the frozen HealthResponse schema: ${error.message}`);
}

if (!isValidCorrelationId(payload.correlation_id)) {
  fail('correlation_id did not match the frozen ID pattern');
}

console.log(`PASS  ${target}`);
console.log(`      status 200 in ${elapsedMs} ms`);
console.log(`      schema_version ${payload.schema_version}, service ${payload.data.service}`);
console.log(`      correlation_id ${payload.correlation_id}`);
console.log(
  baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')
    ? '      scope: LOCAL run — this is not deployment evidence'
    : '      scope: remote endpoint',
);
