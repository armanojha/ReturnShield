# Phase 03 handoff — ListingGuard end to end

Phase 03 is implemented on `main` and verified locally. The implementation is ready for the AWS deployment gate; it has not yet been deployed or exercised against Bedrock.

## Delivered

- Added frozen AI validator access for `ListingGuardOutput` in `packages/contracts`.
- Added `services/listing` with prompt versioning, Bedrock Converse client, timeout handling, strict schema validation, evidence grounding, safe failure behavior, listing mapper and API handler.
- Added `POST /v1/listings/analyze` with required idempotency key, replay, conflict and in-progress handling.
- Added `GET /v1/listings/{listing_id}` and DynamoDB persistence through the Phase 02 repositories.
- Wired the ListingGuard Lambda, DynamoDB permissions, Bedrock permission, logs, environment configuration and API Gateway routes in the CDK stack.
- Replaced the marketplace placeholder with a seller form and validated result/evidence panel.
- Added focused clean, contradiction, malformed-response and grounding tests.
- Updated infrastructure assertions for the Phase 03 routes and separate health/listing permissions.

## Verification

- `python product/verify_contracts.py`: 449 checks passed; frozen contracts unchanged.
- `npm run verify`: passed formatting, lint, schema checks, workspace typechecks, unit tests, contract tests, builds and CDK synthesis.
- ListingGuard tests: 4 passed.
- CDK synthesis includes the listing Lambda and both listing routes.

## AWS gate

Before calling Phase 03 complete, deploy the updated stack with `BEDROCK_MODEL_ID` set to a model enabled in the target region, then exercise:

1. `POST /v1/listings/analyze` with a clean listing and a unique `Idempotency-Key`.
2. Replay the same request and confirm the stored result is returned without a second analysis.
3. Submit a contradictory listing and confirm `CORRECTION_REQUIRED` with grounded evidence.
4. `GET /v1/listings/{listing_id}` and confirm the persisted result matches the POST response.

The deployment requires Bedrock model access in the AWS account and the Lambda role permission is intentionally scoped to `bedrock:Converse`. The current stack uses `amazon.nova-lite-v1:0` unless `BEDROCK_MODEL_ID` is supplied at deploy time.

The implementation was completed as an integrator change on `main` because the user explicitly required all current work to remain on `main`; this overrides the vault’s one-task-per-session workflow rule for this session only.

Next action: deploy, run the four remote checks above, record the outputs here, and stop for the Phase 03 approval gate before Phase 04.
