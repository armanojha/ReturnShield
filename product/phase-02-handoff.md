# Phase 02 handoff — data layer and deterministic seeds

Branch: `codex/phase-00-contract-lock`. Phase 02 status: **DONE LOCALLY; AWS DATA DEPLOYMENT/ROUND-TRIP DEFERRED**.

The user explicitly chose a deployment-deferred workflow until AWS credentials are configured. Production code targets DynamoDB through AWS SDK v3 and CDK; test doubles exist only behind injected store interfaces. No separate local runtime architecture was introduced.

## Tasks

| Task       | Dependency evidence                   | Owned paths                            | State        |
| ---------- | ------------------------------------- | -------------------------------------- | ------------ |
| P2-DB-01   | Phase 01 table and CDK synth passed   | `infra/data/**` plus integrator wiring | DONE LOCALLY |
| P2-REP-01  | P2-DB-01 key/index contract           | `services/data/**`                     | DONE LOCALLY |
| P2-IDEM-01 | Repository storage boundary available | `services/shared/idempotency/**`       | DONE LOCALLY |
| P2-SEED-01 | Frozen data/risk/seed contracts       | `data/seed/**`                         | DONE LOCALLY |
| P2-SEED-02 | P2-DB-01 and P2-SEED-01               | `scripts/seed/**`                      | DONE LOCALLY |
| P2-FIX-01  | Shared frozen validators              | `apps/web/src/fixtures/**`             | DONE LOCALLY |

## Delivered behavior

- The existing core table now has seller, customer, order and case-queue GSIs, production deletion protection, existing production PITR/retain behavior and AWS-owned encryption. No MVP entity or idempotency record expires.
- Validated repositories cover Seller, Listing, Customer, Order, ReturnCase and RiskEvent. They provide conditional creates, relationship queries, atomic case/event creation, optimistic case revision, immutable decided policy fields and stable risk-event identity.
- Idempotency uses order ID exclusively for returns, scoped keys for other POSTs, canonical JSON/SHA-256 payload identity, strongly consistent reads and atomic reserve/complete/fail/resume transitions.
- Seed input is deterministically projected from `contracts/seeds/stories.json`: 3 sellers, 3 listings, 3 customers and 3 orders. Expected cases/events are verification truth and are not preloaded.
- Reset/load/verify tools require an explicit dev/test/local target, reject production, restrict endpoint overrides to local mode and require exact table-name confirmation before reset. Reset deletes only enumerated ReturnShield seed/story keys.
- Frontend fixtures cover every frozen v1 response family and structured errors; every fixture is validated before export and clearly identified as development/test data.

## Verification evidence

- `python product/verify_contracts.py`: Phase 00 baseline remains at 449 passing checks.
- `npm run typecheck`: every workspace passes strict TypeScript.
- Phase 02 focused tests pass for repositories, idempotency, seed projection and seed lifecycle.
- `npm run test:unit`: 96 tests pass, covering repository round trips, duplicate conflicts, revision protection, risk-event relationships, missing-versus-empty reads, idempotency concurrency/replay/conflict/recovery, seed counts/IDs/relationships/repeatability, fixture validation and CDK indexes.
- `npm run test:contract`: 36 tests pass, including runtime validation of frozen entity definitions.
- `npm run build` and `npm run synth`: CDK synthesizes the health path and indexed data table.
- `npm run verify`: PASS (format, lint, schema drift, typecheck, unit tests, contract tests, build and CDK synth).

The seed lifecycle integration test runs through the real load/reset/verify orchestration against an injected store. A live DynamoDB table was not available, so AWS SDK network round trips, deployed index behavior and IAM policies remain cloud verification items. No AWS operation, secret, deployed identifier or real PII was used.

## Cloud follow-up

When AWS access is configured:

1. Review `cdk diff` and deploy the dev stack.
2. Run `npm run seed:reset -- --env dev --table returnshield-dev-core --region <region> --confirm returnshield-dev-core`.
3. Run `npm run seed:load -- --env dev --table returnshield-dev-core --region <region>` twice to prove idempotent logical results.
4. Run `npm run seed:verify -- --env dev --table returnshield-dev-core --region <region>` and confirm the exact 3/3/3/3/0/0 inventory.
5. Exercise repository reads/writes and conditional duplicate behavior against the deployed table.

Phase 03 may be authored under the same deployment-deferred policy, but neither Phase 01 nor Phase 02 should be represented as cloud-verified until their remote checks pass.
