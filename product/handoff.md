# Phase 00 integrator handoff

Branch: `codex/phase-00-contract-lock`. Human approval: **APPROVED 2026-09-18**. Phase 00: **DONE**. Phase 01: **READY, NOT STARTED**.

The user's explicit request to produce Phase 00 in one session authorizes sequential execution of its six individually scoped tasks. No agents or overlapping owners are active. Each task owns only its listed document subtree; the integrator owns this handoff and verification tooling. Source files remain unchanged.

| Order | Task | Dependency confirmation | Owned paths | State |
|---|---|---|---|---|
| 1 | P0-PROD-01 | Available authoritative source notes read; source PDF absent | docs/product/** | DONE |
| 2 | P0-CON-01 | P0-PROD-01 DONE | docs/contracts/api/** | DONE |
| 3 | P0-DATA-01 | P0-PROD-01 DONE | docs/contracts/data/** | DONE |
| 4 | P0-RISK-01 | P0-PROD-01 DONE | docs/contracts/risk/** | DONE |
| 5 | P0-AI-01 | P0-CON-01 authored and reviewed before AI schema; combined reference verification passed | docs/contracts/ai/** | DONE |
| 6 | P0-SEED-01 | P0-DATA-01 and P0-RISK-01 authored and reviewed before fixtures; seed verification passed | docs/contracts/seeds/** | DONE |

DONE means artifact authoring and integrator contract checks complete. The complete Phase 00 baseline received explicit human approval on 2026-09-18. P0-PROD-01 review: scope, flow, tiers, cut order, conflicts and gate are explicit in scope.md.

## Changed files and acceptance evidence

- Product: scope.md, this handoff, approval-gate.md, baseline-manifest.json, source-manifest.json and the two document authoring/verification scripts.
- API: openapi.json lists all nine routes; http.schema.json defines requests, query, responses and errors; semantics.md freezes POST reservations/replays/conflicts, paging, dashboard counts and reviewer transitions.
- Data: entities.schema.json and relationships.md cover six entities, evidence, timeline, integrity and state semantics.
- Risk: policy.json, policy.md and evaluation.schema.json specify exact predicates, weights, boundaries, missing context and output mapping.
- AI: models.schema.json and validation-and-failure.md constrain both model boundaries, event detail, evidence and failure handling.
- Seeds: stories.json and truth.md contain complete synthetic inputs and exact outcomes/evidence.

Commands run from repository root:

1. `python docs/product/author_contracts.py` — generated only contract documents and fixtures in dependency order. Do not rerun after approval without ADR review.
2. `python docs/product/verify_contracts.py` — PASS: 436 checks before manifest checks; four JSON Schema bundles, nine endpoints, six entities, three stories; all refs resolve offline. Re-run after manifest creation also verifies file hashes/inventory.
3. `git diff --check` and staged equivalent — whitespace validation.

Negative fixture testing found optional date-time validation was unavailable in the installed jsonschema environment. Fixed with UTC schema patterns and an explicit calendar-aware format checker; rerun passed. Other rejection fixtures cover versions, unknown fields, AI decision injection, score bounds, priority mismatch and incomplete-data scoring. Cross-record relationships, evidence references, source weights, 0/29/30/59/60/100 routing, 110 clamp and exact seeds are checked. These checks validate contracts only; no claim of runtime concurrency, persistence, live models or AWS deployment is made.

## Baseline and handoff

Candidate tag: `phase-00-contracts-v1.0.0-candidate`. Approved tag: `phase-00-contracts-v1.0.0`. The approved tag points at the approval-record commit. baseline-manifest.json hashes every contract file using UTF-8 with LF-normalized newlines, so Windows Git newline conversion does not invalidate a fresh checkout. Final verifier result: 449 checks passed. source-manifest.json records raw-byte hashes of the available vault Markdown used as planning context. No source vault edits, application folders, dependencies, CI or AWS resources were created. No merge or push is performed.

Risks: the original PDF/report is unavailable; proposed triggers are synthetic demo policy, not empirically calibrated; source references contain conflicts explicitly reconciled in scope.md. JSON Schema cannot prove evidence semantics or arithmetic equality; the verifier covers the fixtures and the later production validator/evaluator must enforce the documented invariants for arbitrary inputs. Auth and deployment access controls require later runtime work.

Next action: the integrator may claim P1-REP-01 and begin Phase 01 in a separately scoped task. Phase 01 has not started in this handoff.
