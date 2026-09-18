# Phase 00 approval gate — approved

Review candidate tag: `phase-00-contracts-v1.0.0-candidate`.
Approved baseline tag: `phase-00-contracts-v1.0.0`.

The Phase 00 artifacts were explicitly approved by the user on 2026-09-18. The approval covers the candidate contract listed below without revisions. Phase 00 is complete. No Phase 01 work has begun in this approval record.

Start with [scope](scope.md), [API semantics](../contracts/api/semantics.md), [risk policy](../contracts/risk/policy.md), and [seed truth](../contracts/seeds/truth.md). Full evidence is in [handoff](handoff.md).

Approval covers the following concrete proposed choices that the vault left unspecified:

| Decision | Candidate contract |
|---|---|
| Seller +30 | Prior 90-day return rate >=20% OR dispute count >=3 |
| Listing +25 | Validated CORRECTION_REQUIRED |
| Customer +20 | At least 3 prior returns in 30 days |
| Current return +20 | NOT_RECEIVED claim against DELIVERED order |
| Category +15 | ELECTRONICS; APPAREL/HOME contribute zero |
| Scoring | Binary full-weight/zero predicates; clean 0, review 45, high raw 110 -> score 100 |
| Missing context | Explicit ERROR_MISSING_CONTEXT, null score/decision/priority, visible operations error; no false scored result |
| POST identity | Returns use order_id only; listing/reviewer POSTs require scoped Idempotency-Key; atomic durable reservation before side effects |
| Reviewer outcome | Separate APPROVE_RETURN/DECLINE_RETURN disposition; one final action; original deterministic result immutable |
| API shape | Nine v1 routes, schema_version 1.0.0, cursor paging, complete case read model and specified dashboard counts |
| AI boundaries | Strict typed output, supplied evidence only, bounded retries; no score/decision mutation or trusted fallback |

Weights and thresholds come from the vault. Predicate cutoffs are proposed demo choices. The source PDF/report is absent; available authoritative Markdown takes precedence over older reference conflicts, as recorded in scope.md.

Required gate source: `D:\PROJRCTS\returensheild_vault\PHASE-INDEX.md`: “Phase 00 requires human approval before application coding begins.” Phase 00 exit condition: “All Phase 0 artifacts are approved and no Phase 1 task depends on an unanswered decision.”

Approval evidence: user message, “i approve Phase 00”. After this approval, schema, policy, entity, threshold, seed-truth or architecture changes require an ADR plus dependent-task review.
