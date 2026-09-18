# Synthetic seed truth

stories.json fixes inputs, exact IDs, timestamp, five evidence-backed events, expected policy results and complete expected cases. Baseline inventory before workflow: 3 sellers, 3 listings, 3 customers, 3 orders, zero cases/events. After running the three returns: 3 cases, 15 RiskEvents; two review events and two validated explanations when enabled. Expected cases are verification fixtures, not records to preload before demonstrating workflow creation. Aggregate prior-history metrics describe synthetic external marketplace history; no dangling prior case IDs are introduced. Seed loader/reset is Phase 02, not implemented here.

| Story | seller | listing | customer | return | category | raw | score | decision/priority |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| clean | 0 | 0 | 0 | 0 | 0 | 0 | 0 | AUTO_APPROVE/NONE |
| review | 30 | 0 | 0 | 0 | 15 | 45 | 45 | NEEDS_REVIEW/NORMAL |
| high | 30 | 25 | 20 | 20 | 15 | 110 | 100 | NEEDS_REVIEW/HIGH |

High listing contains exact contradictory new/used quotations and must be CORRECTION_REQUIRED/high. Other listings are PASS/low. Listing analysis fixtures are validated expected examples, not a guarantee of verbatim live model output. Deterministic cases use the persisted validated listing status; real model integration must separately pass Phase 03. Live explanations may vary in wording but must satisfy schema/grounding, preserve every policy field and reference only the fixed case evidence. Fixture explanation text demonstrates the expected shape, not a claimed Bedrock run.

Expected dashboard after all stories: flagged_listings=1, auto_approved_returns=1, normal_review_cases=1, high_review_cases=1, open_review_cases=2, missing_context_cases=0. Queue at equal timestamps sorts CASE-clean, CASE-high, CASE-review by ID. Replaying each return retains its original case, 15 total events and two explanations. Removing required context yields ERROR_MISSING_CONTEXT with null score and no policy decision; malformed AI output leaves the review decision unchanged and explanation UNAVAILABLE. Approval of these explicit predicates and truth is required before implementation.
