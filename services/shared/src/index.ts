/**
 * `@returnshield/shared` — cross-service runtime modules.
 *
 * Phase 02 (task P2-IDEM-01) adds the idempotency subsystem. Re-exported
 * here so consumers can `import { reserveOrReplay } from '@returnshield/shared'`
 * as well as the more specific `@returnshield/shared/idempotency` path.
 */
export * from './idempotency/index.js';
