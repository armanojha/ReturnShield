/**
 * Canonical Phase 02 key schema (task P2-DB-01) for the shared
 * `returnshield-<env>-core` DynamoDB table created in Phase 01
 * (`infra/lib/returnshield-stack.ts`).
 *
 * This module is the infrastructure-side source of truth for key prefixes,
 * GSI names and GSI attribute names. `services/data/src/shared/keys.ts`
 * (application code, owned by task P2-REP-01) defines an application-side
 * copy of the same prefixes and index names, because `services/data` does
 * not — and should not — depend on the `infra` CDK workspace at runtime.
 * The two modules MUST stay in sync. See `README.md#keeping-infra-and-services-data-in-sync`.
 */

/** Existing Phase 01 table key attribute names. Unchanged by Phase 02. */
export const TABLE_PRIMARY_KEY = 'pk';
export const TABLE_SORT_KEY = 'sk';

/** Global secondary index names added by `ReturnShieldDataIndexes`. */
export const GSI = {
  /** Seller -> Listing / Order / ReturnCase item-collection access pattern. */
  BY_SELLER: 'gsi1-by-seller',
  /** Customer -> Order / ReturnCase item-collection access pattern. */
  BY_CUSTOMER: 'gsi2-by-customer',
  /** Order -> ReturnCase lookup (idempotency + relationship verification). */
  BY_ORDER: 'gsi3-by-order',
  /** GET /cases queue: all decided/processing cases sorted by created_at desc, case_id asc. */
  CASE_QUEUE: 'gsi4-case-queue',
} as const;

/** Partition/sort key attribute names for each GSI above. */
export const GSI_ATTR = {
  BY_SELLER: { pk: 'gsi1pk', sk: 'gsi1sk' },
  BY_CUSTOMER: { pk: 'gsi2pk', sk: 'gsi2sk' },
  BY_ORDER: { pk: 'gsi3pk', sk: 'gsi3sk' },
  CASE_QUEUE: { pk: 'gsi4pk', sk: 'gsi4sk' },
} as const;

/** Entity-identity key prefixes shared by every item in the single-table design. */
export const KEY_PREFIX = {
  SELLER: 'SELLER#',
  LISTING: 'LISTING#',
  CUSTOMER: 'CUSTOMER#',
  ORDER: 'ORDER#',
  CASE: 'CASE#',
  RISK_EVENT: 'RISKEVENT#',
  IDEMPOTENCY: 'IDEMP#',
} as const;

/**
 * Single logical partition for the case queue GSI. The synthetic Phase 02
 * dataset is small (a handful of cases), so one partition is sufficient for
 * the demo; a later phase that needs to shard this at scale would replace
 * it with a bounded set of partitions (e.g. by date bucket) without
 * changing any entity contract.
 */
export const CASE_QUEUE_PARTITION = 'CASE_QUEUE';

/**
 * Reserved TTL attribute name. NOT enabled on the table in Phase 02: the
 * frozen API semantics ("Retain reservations and response identity for the
 * lifetime of the associated record (no TTL expiry in MVP)") mean no
 * Phase 02 record — including idempotency reservations — should expire.
 * The name is reserved here so a later phase that does add an expiring
 * record type has a documented, non-conflicting attribute to use.
 */
export const RESERVED_TTL_ATTRIBUTE = 'ttl';
