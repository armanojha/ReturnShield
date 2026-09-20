---
phase: 7B
status: IMPLEMENTED — local verification complete; live deployment remains external
---

# Phase 7B handoff — E-commerce platform integration

ReturnShield now exposes a server-to-server partner surface for the demo store. The
storefront keeps the API key server-side, uses stable identifiers, sends frozen
contracts, and uses idempotency keys for every mutating operation.

## ReturnShield changes

- Added `services/partner/` with the `POST /v1/partner/context` handler and tests.
- Added the `PARTNER_CONTEXT` idempotency scope and key builder in `services/shared`.
- Added a partner Lambda, API Gateway route, generated API key, usage plan, CORS
  `x-api-key` support, least-privilege DynamoDB access, and stack outputs in
  `infra/lib/returnshield-stack.ts`.
- Protected listing analysis, return creation, partner context, and image upload
  mutations with the API key.
- Added `product/adr/0002-demo-store-partner-api.md`.

## Demo store changes

- Added the server-only ReturnShield client at
  `apps/storefront/src/lib/returnshield/client.ts`.
- Replaced mock listing, return, and reviewer-decision routes with live ReturnShield
  calls, retries, stable IDs, exact request envelopes, and honest failure responses.
- Added partner context synchronization from Vendure seller/customer/order data.
- Added optional listing and return image evidence uploads.
- Removed the invalid Vendure ReturnShield plugin and hard-coded admin credentials.
- Added environment documentation, storefront provenance metadata, and static security
  boundary tests.

## Verification

ReturnShield verification completed successfully:

```
npm run verify
```

This passed format, lint, schema mirror, typecheck, unit tests, contract tests, build,
and CDK synth. Infra tests passed separately: 18 tests.

Demo-store checks completed:

- `npm run check-types --workspace storefront` — passed.
- `npm run lint --workspace storefront` — passed with eight pre-existing warnings and
  zero errors.
- `npm run upgrade:validate --workspace storefront` — passed.
- ReturnShield boundary tests — 5/5 passed.
- `npm run test --workspace storefront` — 26/28 passed. Two existing repository
  constraints remain: the architecture test rejects pre-existing direct implementations
  under `src/app`, and the symlink fixture requires Windows Developer Mode or an
  equivalent symlink privilege.
- `npm run build` — Vendure server build passed and Next.js compiled/typechecked; page
  generation requires a reachable `VENDURE_SHOP_API_URL`, so it failed locally with
  `ECONNREFUSED` against the placeholder localhost URL.

## Deployment runbook

Run from AWS CloudShell, where credentials and the AWS CLI are available:

```
cd ~/ReturnShield
git pull --ff-only origin main
export AWS_REGION=ap-southeast-2
export AWS_DEFAULT_REGION=ap-southeast-2
export BEDROCK_MODEL_ID=amazon.nova-lite-v1:0
npm install
npm run deploy --workspace infra -- -c envName=dev -c gsiStage=4
```

Retrieve the generated key value using the `DemoStoreApiKeyId` output:

```
aws apigateway get-api-key --api-key <DemoStoreApiKeyId> --include-value \
  --query value --output text --region ap-southeast-2
```

Configure the demo store server environment without committing secrets:

```
RETURNSHIELD_API_URL=<ApiBaseUrl without a trailing slash>
RETURNSHIELD_API_KEY=<retrieved API key value>
VENDURE_SHOP_API_URL=<reachable Vendure Shop API URL>
VENDURE_ADMIN_API_URL=<reachable Vendure Admin API URL>
VENDURE_ADMIN_USERNAME=<server-side Vendure admin user>
VENDURE_ADMIN_PASSWORD=<server-side Vendure admin password>
```

Then deploy the demo store and run the live seller listing, customer return, reviewer
decision, duplicate replay, and Operations Center checks. Confirm the same listing ID,
order ID, case ID, risk decision, and correlation IDs are visible across both systems.

## Remaining external gate

No AWS deployment or live cross-repository test was run from this Windows machine because
the AWS CLI is unavailable locally. No secrets are stored in either repository. Commit
and push the two `main` branches before running the CloudShell deployment.
