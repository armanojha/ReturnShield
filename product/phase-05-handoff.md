# Phase 05 handoff — return intake and workflow

Status: implementation and local verification complete. The AWS deployment and real state-machine exit gate remain to be run against the dev stack.

## Delivered

- `POST /v1/returns` validates the frozen request contract, resolves the order and required related records, reserves by `order_id`, starts one stable Step Functions execution and returns the frozen `ReturnResponse` shape.
- Exact replays keep the same `case_id`; processing replays return 202, terminal replays return the current persisted case with 200, and changed payloads for the same order return 409.
- `@returnshield/context` loads order, seller, listing and customer data and constructs evidence-backed deterministic history input. Missing records are explicit.
- `@returnshield/workflow` adapts context to `@returnshield/risk-policy`, builds contract-valid terminal cases and risk events, and persists them atomically through the Phase 02 repository.
- The standard Step Functions workflow has the required state names in order: `ValidateReturn`, `FetchHistory`, `CalculateSignals`, `CalculateRisk`, `Decision`, `CreateOrUpdateCase`, `NeedsReviewEvent`, `InvestigationExplanation`, `SurfaceToReviewer`.
- Retries are limited to history reads, deterministic risk calculation and the idempotent protected write. The state machine and both Lambdas have bounded timeouts and dedicated retained log groups.
- Review-event, Investigator and reviewer-surface states expose the Phase 06/07 integration points without introducing those later-phase services.
- CDK wires the return Lambda to `POST /v1/returns`, grants only table/log/start-execution access, and outputs the function name and workflow ARN.

No frozen contract or seed file changed. No `apps/web` or dashboard/e-commerce UI file changed because those surfaces are being built separately.

## Files

- Created `services/context/**`
- Created `services/returns/**`
- Created `services/workflow/**`
- Created `infra/workflow/return-workflow.ts`
- Updated `infra/lib/returnshield-stack.ts`
- Updated `infra/test/returnshield-stack.test.ts`
- Updated `package-lock.json`

## Local verification

- `npm run verify` — passed.
- `python product/verify_contracts.py` — passed: 449 checks, 4 schema bundles, 9 endpoints, 6 entities and 3 exact seed stories.
- Workflow tests — 5 passed, covering clean/review/high outcomes, missing context and repeatability.
- Infrastructure tests — 14 passed; CDK synth bundled health, ListingGuard, return workflow worker and return intake Lambdas.
- Frozen schema mirror — all 7 contracts match.

## AWS deployment and exit gate

Run from the CloudShell repository checkout:

```bash
cd ~/ReturnShield
git pull --ff-only origin main
npm install
export AWS_REGION=ap-southeast-2
export AWS_DEFAULT_REGION=ap-southeast-2
npm run deploy --workspace infra -- -c envName=dev -c gsiStage=4
```

Use the deployed `ApiBaseUrl` to submit the clean, review and high requests from `contracts/seeds/stories.json`. For each request, confirm:

1. the first response is 202 with `PROCESSING` and `replayed=false`;
2. an immediate exact duplicate has the same `case_id` and `replayed=true`;
3. a later exact duplicate is 200 with the terminal case;
4. clean becomes `AUTO_APPROVE/NONE`, review becomes `NEEDS_REVIEW/NORMAL`, and high becomes `NEEDS_REVIEW/HIGH`;
5. scores, raw totals, contributions, evidence references and priorities match the seed expectations;
6. the Step Functions execution and CloudWatch logs carry the same `case_id` as the stored record;
7. changing the payload for an already used `order_id` returns 409.

Phase 06 should begin only after this live exit gate passes.
