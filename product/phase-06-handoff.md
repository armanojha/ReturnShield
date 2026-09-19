# Phase 06 handoff — review events and Investigator

Status: implementation and local verification complete. AWS deployment and the live EventBridge/Bedrock exit gate remain to be run from CloudShell.

## Delivered

- Review cases emit a contract-validated `RETURN_NEEDS_REVIEW` event after the deterministic case write. Event identity is stable across workflow retries.
- A custom EventBridge bus and filtered rule invoke the Investigator Lambda. Delivery has bounded retries, a one-hour maximum event age and an encrypted SQS dead-letter queue.
- The Investigator sends Bedrock only the persisted policy result, attached evidence and evidence-ID allowlist.
- Model output is accepted only after frozen-schema validation and grounding checks. Every factor must match a positive deterministic signal and cite evidence attached to that signal.
- Unsupported evidence, invented identifiers or numbers, accusatory wording, malformed JSON and oversized output are rejected. Raw model output is never persisted or logged.
- Successful explanations update only explanation fields, revision, timestamp and one stable `EXPLANATION_AVAILABLE` timeline entry.
- Transient model failures move to `RETRY_PENDING` and trigger one Lambda retry. Exhausted or invalid results become `UNAVAILABLE`; deterministic scores, decisions, priorities, contributions and reviewer state remain unchanged.
- Duplicate and concurrent EventBridge deliveries cannot create a second explanation or timeline entry.
- The existing nine-state return workflow is preserved. `NeedsReviewEvent` now publishes to EventBridge, and `InvestigationExplanation` remains the asynchronous integration checkpoint.
- Investigator IAM permits only `bedrock:InvokeModel` against the configured foundation-model and inference-profile resources. Table, logging, event publishing and queue permissions are granted through their specific constructs.

No frozen contract, seed, threshold, score or decision changed. No `apps/web`, dashboard or e-commerce UI file changed.

## Files

- Created `services/investigation/**`
- Created `infra/events/review-events.ts`
- Created `services/workflow/src/review-event.ts`
- Created `services/workflow/test/review-event.test.ts`
- Updated workflow handler, processor, types, exports and dependencies
- Updated CDK stack, workflow construct and infrastructure assertions
- Extended the existing runtime AI validator name union for the already-frozen Investigator and review-event definitions
- Updated `package-lock.json` through `npm install`

## Verification

- `npm run verify` — passed.
- `python product/verify_contracts.py` — passed: 449 checks, 4 schema bundles, 9 endpoints, 6 entities and 3 exact seed stories.
- Investigator tests — 48 passed.
- Workflow tests — 8 passed.
- Infrastructure tests — 16 passed.
- CDK synth — passed and bundled all five Lambdas.
- `cdk diff` synthesized successfully but could not create the account-aware diff locally because this Windows session has no AWS account credentials. Run it in CloudShell before deployment.

## Deploy

```bash
cd ~/ReturnShield
git pull --ff-only origin main
npm install
export AWS_REGION=ap-southeast-2
export AWS_DEFAULT_REGION=ap-southeast-2
export BEDROCK_MODEL_ID=amazon.nova-lite-v1:0
npm run diff --workspace infra -- -c envName=dev -c gsiStage=4
npm run deploy --workspace infra -- -c envName=dev -c gsiStage=4
```

## Live exit gate

The Phase 05 `CASE-high` record is already `PENDING`, so it can validate the new event path without changing deterministic data. Publish the frozen event after deployment:

```bash
aws events put-events --region ap-southeast-2 --entries '[{"Source":"returnshield.returns","DetailType":"RETURN_NEEDS_REVIEW","EventBusName":"returnshield-dev-events","Detail":"{\"schema_version\":\"1.0.0\",\"event_type\":\"RETURN_NEEDS_REVIEW\",\"event_id\":\"CASE-high-RETURN_NEEDS_REVIEW\",\"case_id\":\"CASE-high\",\"order_id\":\"ORDER-high\",\"seller_id\":\"SELLER-high\",\"listing_id\":\"LISTING-high\",\"policy_version\":\"1.0.0\",\"risk_score\":100,\"priority\":\"HIGH\",\"occurred_at\":\"2026-09-19T12:30:58.664Z\"}"}]'
```

Confirm `FailedEntryCount` is zero, then inspect the persisted case and logs:

```bash
aws dynamodb get-item --region ap-southeast-2 --table-name returnshield-dev-core --consistent-read --key '{"pk":{"S":"CASE#CASE-high"},"sk":{"S":"CASE#CASE-high"}}'
aws logs tail /aws/lambda/returnshield-dev-investigator --since 10m --region ap-southeast-2
```

The case must retain `risk_score=100`, `raw_contribution_total=110`, `decision=NEEDS_REVIEW`, `priority=HIGH` and all five contributions. A successful model result has `explanation_status=AVAILABLE`, grounded evidence references and exactly one `EXPLANATION_AVAILABLE` timeline entry. A model/service failure may produce `RETRY_PENDING` and then `UNAVAILABLE`, while all deterministic fields remain unchanged.

Publish the identical event again and confirm the case revision and timeline do not change. Inspect the DLQ only if delivery fails:

```bash
aws sqs get-queue-attributes --region ap-southeast-2 --queue-url "$(aws cloudformation describe-stacks --region ap-southeast-2 --stack-name returnshield-dev-base --query 'Stacks[0].Outputs[?OutputKey==`InvestigationDeadLetterQueueUrl`].OutputValue' --output text)" --attribute-names ApproximateNumberOfMessages
```

Phase 07 may begin after the live event produces a grounded explanation or the failure path is verified to preserve the deterministic case.
