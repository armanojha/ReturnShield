# Phase 01 handoff — repository foundation

Branch: `codex/phase-00-contract-lock`. Phase 00: **DONE, approved 2026-09-18**. Phase 01: **DONE LOCALLY; AWS DEPLOYMENT BLOCKED BY MISSING HOST CREDENTIALS/CLI**.

## Task status

| Task      | Dependency confirmation      | Owned paths                | State |
| --------- | ---------------------------- | -------------------------- | ----- |
| P1-REP-01 | Phase 00 approved            | root manifests and tooling | DONE  |
| P1-CON-01 | P1-REP-01 DONE               | `packages/contracts/**`    | DONE  |
| P1-INF-01 | P1-REP-01 DONE               | `infra/**`                 | DONE  |
| P1-WEB-01 | P1-REP-01 DONE               | `apps/web/**`              | DONE  |
| P1-API-01 | P1-INF-01 and P1-CON-01 DONE | `services/health/**`       | DONE  |
| P1-CI-01  | P1-REP-01 DONE               | `.github/**`, `scripts/**` | DONE  |

The repository is an npm/TypeScript monorepo with a single lockfile and Node 20.11.1 policy. Shared validators are generated from the frozen Phase 00 JSON Schemas. The CDK base stack defines REST API Gateway, the Node 20 health Lambda, explicit logs, a DynamoDB foundation table and least-privilege IAM. One React application provides `/marketplace` and `/ops`, with a shared contract-validating health client and loading/success/error states. CI runs formatting, lint, schema drift, type checking, tests, builds, synthesis and the Python Phase 00 verifier.

## Phase 00 relocation record

Commit `24e244d` moved `docs/contracts` and `docs/product` to the root-level `contracts` and `product` directories before this verification pass. The frozen contract bytes and SHA-256 digests did not change. Path keys and verifier roots were corrected, and `python product/verify_contracts.py` passed all 449 checks. ADR-0001 records this repository layout decision; it does not change a schema, entity, threshold, policy or runtime architecture.

## Verification evidence

- `python product/verify_contracts.py`: PASS, 449 checks; four schema bundles, nine endpoints, six entities and three exact seed stories.
- `npm install --engine-strict=false`: generated `package-lock.json`. The override was required only because this host provides Node 22.20.0; source policy and CI remain pinned to Node 20.11.1.
- `npm run verify`: PASS. This covers Prettier, ESLint, frozen-schema drift, every workspace type check, 71 test executions (34 shared-contract, 9 health, 16 web and 12 infrastructure), production builds and CDK synthesis.
- `npm run smoke`: PASS against `http://localhost:3001/v1/health`; HTTP 200, schema version 1.0.0, service `returnshield`, valid correlation ID.
- Local route probes: `/marketplace` HTTP 200, `/ops` HTTP 200, and cross-origin `/v1/health` HTTP 200 with JSON and CORS response. Component tests cover loading, valid success, network/HTTP/contract failures and both routes.
- Structured local health logs contained `service`, `event`, `correlation_id` and `outcome` for each request.

Initial verification exposed and fixed duplicate Ajv/Vite dependency versions, an invalid service `rootDir`, lint configuration for tooling output, and an infrastructure test that assumed CDK would not add its automatic API endpoint output. These are now covered by the passing suite.

## Deployment status

No AWS deployment was attempted. The host has no AWS CLI, credentials file, access-key environment variables, profile, or region. `cdk doctor` confirms CDK 2.162.1 and no configured AWS/CDK environment. Synthesis is valid; deployment and remote smoke evidence require an authenticated account and region:

1. Configure AWS credentials and region outside the repository.
2. Bootstrap the target account/region if needed.
3. Run the documented `npm run deploy --workspace infra` command.
4. Run `npm run smoke -- --url <ApiBaseUrl>` and set `VITE_API_BASE_URL` for the web deployment.

No credential, account ID, deployed identifier or real PII is stored in source. Phase 02 and Phase 03 were not started.

## Handoff

The Phase 01 code and local evidence are complete. The remaining external gate is AWS deployment verification. The integrator may begin Phase 02 only if the project accepts “deployment blocked by missing credentials” as the Phase 01 environment exception; otherwise configure AWS and complete the four deployment steps above first.

Git recording is also pending: permission to write protected Git metadata was denied when the verified Phase 00 commit/tag and Phase 01 commits were attempted. The working tree therefore contains the verified implementation and generated lockfile but is not clean. Do not discard it. Once Git permission is available, commit the Phase 00 relocation repair, create `phase-00-contracts-v1.0.0`, then commit the Phase 01 implementation and this handoff.
