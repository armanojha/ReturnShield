# ReturnShield

Marketplace trust and returns review. ReturnShield analyses listings for
contradictions, scores return requests against five deterministic signals, and
gives reviewers a case view that explains **why** a return needs review.

The architectural invariant, from which nothing deviates: **AI explains and
interprets evidence; deterministic policy owns the final decision.** A model may
flag, summarise and explain. It may never write or change a score, decision,
priority or contribution.

All data in this repository is synthetic. There is no real customer data, no
credential, and no deployed identifier in source.

> **Status: Phase 01 (repository foundation).** The deployable skeleton and the
> health path. Listing analysis (Phase 03), the Trust Engine (Phase 04), the
> return workflow (Phase 05) and the Operations Center (Phase 07) are not built
> yet. Routes that will host them say so explicitly rather than showing
> placeholder data.

## Requirements

| Tool       | Version                   | Notes                                                                                 |
| ---------- | ------------------------- | ------------------------------------------------------------------------------------- |
| Node.js    | 20.11.1 (`>=20.11.0 <21`) | Matches the Lambda `nodejs20.x` runtime. `.nvmrc` is provided; `nvm use` picks it up. |
| npm        | >= 10.2.0                 | The only package manager. `engine-strict` is on, so a wrong version fails fast.       |
| Python     | 3.12 with `jsonschema`    | Only to re-run the Phase 00 contract verifier. Not needed for application work.       |
| AWS CLI v2 | current                   | Only for deployment.                                                                  |

## Quick start

```bash
npm install          # also runs `prepare`, which mirrors the frozen contracts
cp .env.example .env # fill in locally; .env is git-ignored
npm run dev:api      # health service on http://localhost:3001
npm run dev          # web app on http://localhost:5173
```

Open <http://localhost:5173/marketplace> and <http://localhost:5173/ops>. Both
show a live health indicator driven by a real `GET /v1/health` request through
the shared API client.

To confirm all three states, stop `npm run dev:api` and reload: the indicator
moves from loading to a failure state and offers a retry. It never shows
"healthy" for a failed, timed-out or contract-invalid response.

## Repository layout

```
apps/web/              React application: /marketplace, /ops, shared layout, API client
packages/contracts/    Shared validation and types derived from the frozen schemas
services/health/       GET /v1/health Lambda
infra/                 AWS CDK stack: API Gateway, Lambda, DynamoDB, CloudWatch, IAM
scripts/               Smoke check
contracts/              Frozen Phase 00 contracts — do not edit (see below)
product/                Scope, approval record, handoffs, contract verifier
.github/workflows/     CI
```

## Commands

Run from the repository root.

| Command                                   | What it does                                              |
| ----------------------------------------- | --------------------------------------------------------- |
| `npm run verify`                          | Everything below, in order. This is what CI runs.         |
| `npm run format:check` / `npm run format` | Prettier.                                                 |
| `npm run lint` / `npm run lint:fix`       | ESLint (flat config, type-aware).                         |
| `npm run check:schemas`                   | Fails if the mirrored contracts drift from `contracts/`.  |
| `npm run typecheck`                       | `tsc --noEmit` across every workspace.                    |
| `npm run test:unit`                       | Unit tests (Vitest).                                      |
| `npm run test:contract`                   | Contract tests against the frozen schemas.                |
| `npm run build`                           | Builds the contracts package and the web bundle.          |
| `npm run synth`                           | `cdk synth` — validates infrastructure without deploying. |
| `npm run smoke -- --url <base>`           | Probes a real `/v1/health` and validates the body.        |
| `npm run dev` / `npm run dev:api`         | Local web app / local health service.                     |

## The frozen Phase 00 contracts

`contracts/**` was approved on 2026-09-18 and is frozen. Every file is hashed in
`product/baseline-manifest.json`. The repository was restructured after
approval (`docs/contracts` → `contracts/`, `docs/product` → `product/`); the
digests are unchanged, only the recorded location moved — see
`product/handoff.md` and `product/phase-01-handoff.md`.

**Do not edit, reformat or regenerate these files.** Prettier is configured to
skip them, because reformatting alone would invalidate the approved baseline.
Any change to a schema, entity, threshold, policy or architectural decision
requires an ADR plus a dependent-task review, per `CODING-RULES.md` rule 4.

Application code never re-authors a contract. `npm run sync:schemas` mirrors the
approved files from `contracts/` into `packages/contracts`, hashes them
LF-normalised to match the baseline manifest, and generates the module the Ajv
validators compile from. So the validators are built from the approved bytes,
not from a hand-written copy. `npm run check:schemas` fails the build on any
drift, and a contract test re-hashes `contracts/` on every run.

## Contracts in application code

Both the web app and the service import `@returnshield/contracts`:

```ts
import { assertValid, healthEnvelope, errorEnvelope } from '@returnshield/contracts';
```

- `healthEnvelope()` / `errorEnvelope()` build the frozen envelopes.
- `assertValid(definition, payload)` validates and narrows, or throws.
- `validateAgainst()` / `isHealthResponse()` validate without throwing.

Responses are validated on **both** sides: the Lambda validates before
responding, and the web client validates before handing anything to a component.
An unexpected payload surfaces as an explicit failure, never as a
partially-rendered success.

## Structured logging

Every service log line is one JSON object carrying `service`, `event`,
`correlation_id` and `outcome`:

```json
{
  "event": "health.request",
  "correlation_id": "9f8f4c2a-1e0b-4f3d-9c7a-2b1d5e6f7a8b",
  "outcome": "success",
  "status_code": 200,
  "service": "returnshield",
  "level": "info",
  "timestamp": "2026-09-18T09:14:02.881Z"
}
```

Correlation IDs are server-generated. A caller-supplied `x-correlation-id` is
honoured only when it already matches the frozen ID pattern; anything else is
replaced rather than sanitised, so a malformed header can never shape an
identifier that later appears in logs. Request bodies, headers, credentials,
stack traces and raw model output are never logged.

Later phases carry `case_id` through the same lines, so a return can be followed
from submission to decision.

## Environment configuration

Copy `.env.example` to `.env`. Every variable is documented there. `.env` is
git-ignored; `.env.example` contains no real values.

| Variable                    | Used by | Purpose                                                               |
| --------------------------- | ------- | --------------------------------------------------------------------- |
| `VITE_API_BASE_URL`         | web     | Base URL of the API stage, no trailing slash.                         |
| `VITE_API_TIMEOUT_MS`       | web     | Client request deadline.                                              |
| `HEALTH_PORT`               | service | Local dev server port.                                                |
| `LOG_LEVEL`                 | service | `debug` \| `info` \| `warn` \| `error`.                               |
| `RETURNSHIELD_ENV`          | infra   | `dev` \| `staging` \| `prod`. Drives resource naming.                 |
| `AWS_REGION`, `AWS_PROFILE` | infra   | Deployment target. Credentials live in the AWS CLI store, never here. |
| `SMOKE_BASE_URL`            | smoke   | Endpoint to probe.                                                    |

## Infrastructure

`infra/` is AWS CDK v2 in TypeScript. Resources are named
`returnshield-<env>-<resource>`.

The stack contains the Phase 01 health path plus the Phase 02 data foundation:
an API Gateway REST API with `/v1/health`, a Node 20 ARM64 Lambda, an on-demand
DynamoDB table with four documented access-pattern indexes, CloudWatch log
groups with explicit retention, and stage access logging.

IAM is least-privilege in substance, not just in name: the health function gets
a bare role granted only `logs:CreateLogStream` and `logs:PutLogEvents` on its
own log group. The AWS managed basic-execution policy is deliberately not
attached, and no DynamoDB or Bedrock permission is granted to a function that
needs neither. A synth test asserts this.

### Deployment prerequisites

1. AWS credentials available to CDK for a synthetic sandbox account. The
   standalone AWS CLI is convenient but not required.
2. That account and region bootstrapped for CDK:
   `npx cdk bootstrap aws://<account-id>/<region>` (run from `infra/`).
3. Permission to create API Gateway, Lambda, DynamoDB, CloudWatch Logs and IAM
   resources.

### Deploy

```bash
npm run synth                                   # validate without deploying
npm run deploy --workspace infra -- -c envName=dev
```

Deployment prints `ApiBaseUrl`, `HealthEndpoint`, `CoreTableName` and
`HealthFunctionName`. Then:

```bash
npm run build
npm run smoke -- --url <ApiBaseUrl>             # validates against the frozen schema
```

Set `VITE_API_BASE_URL` to `ApiBaseUrl` and rebuild the web app to point both
routes at the deployed endpoint.

A smoke pass against `localhost` is local evidence only — the script labels it as
such. Only a pass against a deployed stage URL is deployment evidence.

Account IDs, stack ARNs, API IDs and stage URLs are deployment outputs. They are
never committed.

## Data and synthetic seeds

`services/data` contains the validated DynamoDB repositories. `services/shared`
contains durable POST idempotency. Seed data is projected directly from the
frozen `contracts/seeds/stories.json`; expected cases and risk events are truth
metadata and are not preloaded.

Seed commands hard-refuse production and require an explicit table. Reset also
requires the table name as confirmation:

```bash
npm run seed:load -- --env dev --table returnshield-dev-core --region <region>
npm run seed:verify -- --env dev --table returnshield-dev-core --region <region>
npm run seed:reset -- --env dev --table returnshield-dev-core --region <region> --confirm returnshield-dev-core
```

For an isolated DynamoDB-compatible test endpoint, use `--env local`, the table
name `returnshield-local-core`, and an explicit `--endpoint`. Endpoint overrides
are rejected for AWS dev/test environments.

## Testing

Vitest throughout. Unit tests cover the handler, the logger and the web
components; contract tests validate both accepted and rejected envelopes against
the frozen schemas; infrastructure tests assert the synthesised template.

Rejection cases are tested as deliberately as acceptance cases — unknown fields,
wrong schema versions, malformed correlation IDs, a `degraded` status the frozen
schema does not permit, and an error envelope arriving where a success envelope
was expected.

## Contributing rules

From `CODING-RULES.md` in the planning vault:

1. One task ID per session. Touch only that task's owned paths.
2. Confirm every dependency is `DONE` before editing.
3. Phase 00 contracts are frozen; changes need an ADR and dependent-task review.
4. Synthetic data only. Never commit secrets, credentials or deployed identifiers.
5. Use "elevated risk" and "needs review" — never accusations of fraud.
6. A feature is done only when its acceptance evidence passes through the real
   path. A folder, mock or placeholder is not evidence.
7. Feature owners do not merge their own work.

## Documentation

- `product/scope.md` — product contract and MVP boundary
- `product/approval-gate.md` — the Phase 00 approval record
- `product/handoff.md` — Phase 00 handoff and evidence
- `product/phase-01-handoff.md` — Phase 01 handoff
- `product/phase-02-handoff.md` — Phase 02 data and seed handoff
- `contracts/api/semantics.md` — idempotency, paging and reviewer semantics
- `contracts/risk/policy.md` — signals, weights, thresholds, clamping
