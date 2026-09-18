# Phase 02 data infrastructure (task P2-DB-01)

Status: **WIRED AND VERIFIED LOCALLY, NOT DEPLOYED.** CDK tests and `cdk synth`
pass with the four indexes attached to the existing core table. AWS deployment
remains deferred; see `product/phase-02-handoff.md`.

## Table strategy

Per `PHASE-02-data-and-seeds.md` ("a simpler table strategy is allowed if
documented without changing entity contracts"), Phase 02 **reuses the
existing Phase 01 single table** (`infra/lib/returnshield-stack.ts`'s
`CoreTable`, named `returnshield-<env>-core`, partition key `pk` / sort key
`sk`, on-demand billing) rather than creating a second table. This module
only adds the global secondary indexes Phase 02's access patterns need.

## Encryption, PITR, deletion — already compliant

The existing table declaration already satisfies every Phase 02 requirement
in this area; **nothing needed to change**:

- **Encryption**: no `encryption` prop is set, so DynamoDB uses AWS-owned
  key encryption (the default) — satisfies "AWS-owned encryption unless a
  stronger option is already in use."
- **Point-in-time recovery**: `pointInTimeRecovery: isProduction` — enabled
  for `prod`, off for `dev`/`staging`, matching "enable PITR for production
  configuration."
- **Deletion behavior**: `removalPolicy: isProduction ? RETAIN : DESTROY` —
  matches "retain behavior for production and destroy behavior only for
  dev/test."

Optional hardening suggested for the integrator, not required by Phase 02:
add `deletionProtection: isProduction` to the `dynamodb.Table` props as a
second, independent guard against accidental `cdk destroy` in production.

## TTL — intentionally not enabled

The frozen API semantics (`contracts/api/semantics.md`) state idempotency
reservations are retained "for the lifetime of the associated record (no TTL
expiry in MVP)," and no Phase 02 operational entity (Seller, Listing,
Customer, Order, ReturnCase, RiskEvent) expires either. Per the Phase 02
task instructions ("add TTL only to records that genuinely need
expiration"), **no DynamoDB TTL attribute is enabled on the table**. The
attribute name `ttl` is reserved in `table-schema.ts` for a future phase
that introduces a genuinely expiring record.

## Key design

Single-table item types, all on the existing `pk`/`sk` attributes:

| Item                          | `pk`                                              | `sk`                                  |
| ----------------------------- | ------------------------------------------------- | ------------------------------------- |
| Seller                        | `SELLER#<seller_id>`                              | `SELLER#<seller_id>`                  |
| Listing                       | `LISTING#<listing_id>`                            | `LISTING#<listing_id>`                |
| Customer                      | `CUSTOMER#<customer_id>`                          | `CUSTOMER#<customer_id>`              |
| Order                         | `ORDER#<order_id>`                                | `ORDER#<order_id>`                    |
| ReturnCase                    | `CASE#<case_id>`                                  | `CASE#<case_id>`                      |
| RiskEvent                     | `CASE#<case_id>`                                  | `RISKEVENT#<signal>#<policy_version>` |
| Idempotency (return)          | `IDEMP#RETURN#<order_id>`                         | same as `pk`                          |
| Idempotency (listing analyze) | `IDEMP#LISTING_ANALYZE#<idempotency_key>`         | same as `pk`                          |
| Idempotency (case decision)   | `IDEMP#CASE_DECISION#<case_id>#<idempotency_key>` | same as `pk`                          |

RiskEvent items share their ReturnCase's `pk`, so `GET /cases/{case_id}`'s
canonical read (case + all its RiskEvents) is a single `Query` on
`pk = CASE#<case_id>` — no GSI needed for that path. RiskEvent identity
(`case_id` + `signal` + `policy_version`) is exactly the item's key.

## Global secondary indexes (added by `ReturnShieldDataIndexes`)

| Index              | `pk`                     | `sk`                            | Serves                                                                                                                                                                                                                                                                                                                                                              |
| ------------------ | ------------------------ | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gsi1-by-seller`   | `SELLER#<seller_id>`     | `<TYPE>#<id>`                   | Listings/Orders/Cases for a seller (relationship-integrity checks; future seller-detail reads)                                                                                                                                                                                                                                                                      |
| `gsi2-by-customer` | `CUSTOMER#<customer_id>` | `<TYPE>#<id>`                   | Orders/Cases for a customer (`Customer.case_history` verification)                                                                                                                                                                                                                                                                                                  |
| `gsi3-by-order`    | `ORDER#<order_id>`       | `CASE#<case_id>`                | `ReturnCaseRepository.getByOrderId` — Order→Case relationship integrity. (The `POST /returns` idempotency check itself goes through the idempotency reservation record keyed by `order_id`, not this index — see `services/shared/idempotency`. This index exists for direct relationship reads/tests that shouldn't have to go through the idempotency subsystem.) |
| `gsi4-case-queue`  | constant `CASE_QUEUE`    | `<invertedTimestamp>#<case_id>` | `GET /cases` — sorted by `created_at` descending, `case_id` ascending, per `contracts/api/semantics.md`. `created_at` is immutable, so this key is written once at case creation and never rewritten.                                                                                                                                                               |

All four use `ProjectionType.ALL` — the synthetic dataset is small (a
handful of items per story), so projection cost is not a concern for this
demo, and `ALL` avoids a second read for every relationship/queue query.

`gsi4-case-queue`'s single logical partition is a deliberate demo-scale
simplification, called out in `table-schema.ts`; a production system would
shard it.

## Least-privilege access

- `grantReturnShieldDataAccess(table, grantee)` in `data-indexes.ts` grants
  exactly the DynamoDB actions the repositories issue
  (`GetItem`/`BatchGetItem`/`PutItem`/`UpdateItem`/`Query`/
  `ConditionCheckItem`/`TransactWriteItems`/`TransactGetItems`) scoped to
  the table and its indexes. No Phase 01/02 Lambda calls it yet (Phase 01's
  health function has no data access, and Phase 02 authors no Lambda); it is
  provided for the Phase 03+ integrator to attach to whichever role calls
  `@returnshield/data`.
- `seed-access-policy.json` is a reference least-privilege policy document
  for a **separate**, optional seed-tooling IAM identity (used by
  `scripts/seed/**`, task P2-SEED-02), scoped to `dev`/`test` table ARNs
  only — consistent with that tooling's hard refusal to target production.

## Integration status

The integrator wired `ReturnShieldDataIndexes` into
`infra/lib/returnshield-stack.ts`, enabled production deletion protection and
included the data tests in `infra/vitest.config.ts`. Phase 03+ Lambdas should
call `grantReturnShieldDataAccess(this.table, function)` only when they begin
using these repositories.

## Keeping infra and services/data in sync

`table-schema.ts` (here) and `services/data/src/shared/keys.ts` (task
P2-REP-01) independently declare the same key prefixes and GSI names,
because `services/data` cannot depend on the `infra` CDK workspace at
runtime (CDK is a synth-time tool, not a Lambda dependency) and this task
does not touch `services/data/**` or any root manifest to create a third
shared package. **Any change to a prefix or index name must be made in
both files.** A drift test comparing the two modules would be a good
Phase 03 hardening addition; none exists yet — see the Phase 02 handoff
risks.
