# ReturnShield

ReturnShield is an AWS-native marketplace trust and returns platform. It analyzes listings, evaluates return risk from deterministic evidence, and gives reviewers an auditable case history.

AI interprets and explains evidence. Deterministic policy owns every score, priority, and decision.

## Capabilities

- Listing analysis with structured evidence
- Deterministic return-risk evaluation
- Explainable reviewer cases and timelines
- Durable request idempotency and duplicate protection
- Contract-validated API boundaries
- Synthetic clean, review, and high-risk scenarios
- AWS infrastructure defined with CDK

All repository data is synthetic.

## Architecture

```text
React web app
      │
API Gateway
      │
Lambda services ── shared contracts and idempotency
      │
DynamoDB repositories
      │
CloudWatch logs
```

The DynamoDB data layer supports sellers, listings, customers, orders, return cases, and risk events. Conditional writes, atomic transactions, optimistic revisions, and stable event identities protect workflow consistency.

## Technology

- TypeScript and Node.js 20
- React and Vite
- AWS CDK v2
- API Gateway, Lambda, DynamoDB, and CloudWatch
- Ajv JSON Schema validation
- Vitest and ESLint

## Requirements

- Node.js 20.11 or later within the Node 20 release
- npm 10.2 or later
- AWS credentials and AWS CLI v2 for deployment
- Python 3.12 with `jsonschema` for baseline contract verification

## Setup

```bash
npm install
cp .env.example .env
npm run dev:api
npm run dev
```

The web app runs at `http://localhost:5173`. The local health service runs at `http://localhost:3001`.

## Commands

| Command                             | Purpose                                                                              |
| ----------------------------------- | ------------------------------------------------------------------------------------ |
| `npm run verify`                    | Run formatting, linting, schema checks, type checks, tests, build, and CDK synthesis |
| `npm run dev`                       | Start the web app                                                                    |
| `npm run dev:api`                   | Start the local health service                                                       |
| `npm run test:unit`                 | Run unit tests                                                                       |
| `npm run test:contract`             | Validate API and entity contracts                                                    |
| `npm run synth`                     | Synthesize the CDK stack                                                             |
| `npm run smoke -- --url <base-url>` | Validate a deployed health endpoint                                                  |

## Repository

```text
apps/web/             React application and API fixtures
contracts/            Versioned API, data, risk, AI, and seed contracts
data/seed/            Deterministic synthetic scenarios
infra/                AWS CDK infrastructure
packages/contracts/   Shared contract types and runtime validation
scripts/seed/         Safe seed load, verify, and reset commands
services/data/        DynamoDB repositories
services/health/      Health API service
services/shared/      Shared idempotency behavior
```

## Contracts

Runtime validators are generated from the versioned schemas in `contracts/`. Service responses and frontend inputs are validated at their boundaries. `npm run check:schemas` detects mirror drift, and contract tests reject incompatible schema versions, unknown fields, and invalid envelopes.

## Deployment

Authenticate with AWS and bootstrap the target account and region once:

```bash
npx cdk bootstrap aws://<account-id>/<region> --profile <profile>
```

Review and deploy the development stack:

```bash
npm run diff --workspace infra -- --profile <profile> -c envName=dev
npm run deploy --workspace infra -- --profile <profile> -c envName=dev
```

The deployment outputs the API base URL, health endpoint, DynamoDB table name, and Lambda function name.

## Seed data

Seed commands accept explicit development, test, or local targets and reject production targets.

```bash
npm run seed:load -- --env dev --table returnshield-dev-core --region <region>
npm run seed:verify -- --env dev --table returnshield-dev-core --region <region>
npm run seed:reset -- --env dev --table returnshield-dev-core --region <region> --confirm returnshield-dev-core
```

## Security

- Credentials and deployed identifiers stay outside the repository.
- IAM permissions are scoped to each runtime responsibility.
- Logs contain structured operational metadata without request bodies or credentials.
- Risk output uses neutral review language and preserves the evidence behind each result.
