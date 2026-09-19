# Phase 04 handoff — deterministic trust engine

Scope: `packages/risk-policy` only (P4-POL-01..04, P4-QA-01). P4-VIS-01 (`apps/web` risk components) and everything from Phase 05 onward were not touched.

Status: implemented and reviewed by inspection. **Not executed** — the authoring session had filesystem access only (no shell), so typecheck, tests, lint and format have not been run. Commands are listed below.

## Changed files

Created (nothing existing was edited):

- `packages/risk-policy/package.json`
- `packages/risk-policy/tsconfig.json`
- `packages/risk-policy/vitest.config.ts`
- `packages/risk-policy/src/index.ts`
- `packages/risk-policy/src/types.ts`
- `packages/risk-policy/src/config.ts`
- `packages/risk-policy/src/evaluate.ts`
- `packages/risk-policy/src/signals/index.ts`
- `packages/risk-policy/src/signals/shared.ts`
- `packages/risk-policy/src/signals/seller.ts`
- `packages/risk-policy/src/signals/listing.ts`
- `packages/risk-policy/src/signals/customer.ts`
- `packages/risk-policy/src/signals/return.ts`
- `packages/risk-policy/src/signals/category.ts`
- `packages/risk-policy/tests/fixtures.ts`
- `packages/risk-policy/tests/seeds.test.ts`
- `packages/risk-policy/tests/evaluate.test.ts`
- `packages/risk-policy/tests/signals.test.ts`
- `packages/risk-policy/tests/missing-context.test.ts`
- `packages/risk-policy/tests/policy-config.test.ts`
- `product/phase-04-handoff.md`

`contracts/`, `apps/web`, dashboard, ListingGuard, infrastructure, returns, workflow and root manifests are unchanged.

## Implementation behavior

- Package `@returnshield/risk-policy`, `main`/`exports` point at `src/index.ts` (same convention as `data/seed`). No runtime dependencies; no AWS, Bedrock, DynamoDB, HTTP, Lambda, browser, clock or randomness.
- `RISK_POLICY` (`config.ts`, deep-frozen) is the only place thresholds, maxima, rule text, windows and score bands live. Tests assert parity with `contracts/risk/policy.json` and `evaluation.schema.json`.
- Signals, evaluated and emitted in fixed order seller, listing, customer, return, category. Each is all-or-nothing, as the contract enums require:
  - seller (30): `return_rate >= 0.20 OR dispute_count >= 3`
  - listing (25): validated `listing.status == CORRECTION_REQUIRED`
  - customer (20): `recent_returns >= 3`
  - return (20): `request.reason == NOT_RECEIVED AND order.status == DELIVERED`
  - category (15): `listing.category == ELECTRONICS`
- `evaluateRisk(input, policy?)` returns either a `RiskEvaluation` or `MissingContextResult` and never throws on bad input:
  - `raw_contribution_total = sum(points)`; `score = clamp(raw, 0, 100)`; decision/priority come from the clamped score (0–29 AUTO_APPROVE/NONE, 30–59 NEEDS_REVIEW/NORMAL, 60–100 NEEDS_REVIEW/HIGH). Both raw and clamped values are returned.
  - Each contribution carries `signal`, `points`, `max`, `reason` (observed values + rule) and `evidence_refs`. Reason text and evidence ids reproduce `expected_risk_result` in `contracts/seeds/stories.json` exactly for all three seeds.
  - Top-level `evidence_refs` is the de-duplicated union of contribution refs. `toContractResult()` strips it to give the strict contract `Result` shape.
- Missing context: any absent/null/out-of-contract required field (`seller.return_rate`, `seller.dispute_count`, `listing.status`, `listing.category`, `customer.recent_returns`, `request.reason`, `order.status`), `history_complete !== true`, or absent evidence of a signal's kind yields `ERROR_MISSING_CONTEXT` with all `missing_fields` (policy order, de-duplicated). No score, decision or contributions are produced, so nothing contributes a silent zero or auto-approves.
- Evidence rule: each signal cites every valid, attached evidence record of its kind (SELLER_HISTORY, LISTING_CONTENT, CUSTOMER_HISTORY, ORDER_RECORD, CATEGORY_POLICY). `RETURN_STATEMENT` and `CONTEXT_FAILURE` are never cited, matching the seeds.
- AI boundary: the listing signal reads only the validated `listing.status`. `listing.analysis` and `listing.listing_risk` are typed as advisory `unknown` and are never read; tests prove they cannot change any contribution, score, decision or priority.
- Exports: `evaluateRisk`, `composeEvaluation`, `clampScore`, `classifyScore`, `toContractResult`, `isMissingContext`, the five `evaluate*` signal functions, `SIGNAL_EVALUATORS`, `RISK_POLICY`, `POLICY_VERSION`, `SCHEMA_VERSION`, enum lists and all input/output/config types.

## Tests

`packages/risk-policy/tests/**` covers:

- clean, review and high seeds against the stated outcomes and deep equality with `expected_risk_result`;
- band boundaries 0, 29, 30, 59, 60, 100 (via `classifyScore` and `composeEvaluation`; 0/30/60 also through the real signals; 29 and 59 use synthetic composer contributions because the real all-or-nothing signals cannot total 29 or 59; 100 is reached only by clamping 110);
- raw total 110 clamped to 100 with both values kept, and `clampScore` bounds/rejections;
- all 32 signal combinations: contribution sum equals `raw_contribution_total`, score/decision/priority computed independently of the config;
- per-signal threshold edges (0.19/0.20, 2/3 disputes, 2/3 recent returns, reason × order-status grid, categories);
- missing/invalid context for every required field and every evidence kind, null/undefined/empty input, ordering and de-duplication of `missing_fields`;
- evidence references, de-duplication, ignored kinds, copy semantics;
- repeated-evaluation stability, key/evidence-order independence, frozen input, `policy_version`/`schema_version` `1.0.0`, frozen config;
- policy parity with the frozen `policy.json` and `evaluation.schema.json`;
- AI/listing-analysis independence.

Results: not run (no execution tool). Commands to run from the repository root:

```
npm install
npm run typecheck --workspace @returnshield/risk-policy
npm run test:unit --workspace @returnshield/risk-policy
npx prettier --check packages/risk-policy product/phase-04-handoff.md
npx eslint packages/risk-policy
python product/verify_contracts.py
npm run verify
```

If `prettier --check` reports differences, run `npx prettier --write packages/risk-policy product/phase-04-handoff.md`.

## Risks

- **Unexecuted.** All type and test correctness is by inspection; first real run may surface typing nits (notably vitest `it.each` overloads and `exactOptionalPropertyTypes` in test fixtures).
- **Lockfile.** A new workspace package requires `package-lock.json` to be refreshed (`npm install`). The lockfile was not hand-edited. Until refreshed, `npm ci` will report it out of sync. Root manifests/lockfile belong to the integrator.
- **Formatting/lint** were hand-authored to `.prettierrc.json` (100 columns) but not checked by Prettier or ESLint.
- **Interpretations not spelled out in the contracts** (decide during integration review):
  - `history_complete` must be `true` for the seller and customer signals (mirrors the seed field and "complete synthetic history" text).
  - A signal with no attached evidence of its kind is `ERROR_MISSING_CONTEXT`, because every contribution must cite at least one evidence id.
  - Values outside the contract's closed enums/ranges are reported as missing fields rather than scored, since `MissingContext` has no separate invalid-value code.
  - The top-level `evidence_refs` requested for this phase is not part of the frozen `Result` schema (`additionalProperties: false`); use `toContractResult()` before schema validation or persistence.
- Phase 03's AWS deployment gate is recorded as pending in `product/phase-03-handoff.md`. Phase 04 has no dependency on it (depends on Phase 00 and Phase 02), and this work was done on explicit request.
- The vault's `PHASE-04-trust-engine.md` still says `status: PLANNED`; the vault was not edited.

## Next action

Run the commands above and record results here. After they pass and the integrator merges, the follow-ups are P4-VIS-01 (score/contribution UI in `apps/web/src/components/risk`) and the Phase 05 workflow consuming `@returnshield/risk-policy`. Phase 05 has not been started.
