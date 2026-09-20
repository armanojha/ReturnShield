# ReturnShield Frontend Design (Final)

Status: Approved design baseline for the web application (`apps/web`).
Scope: Marketplace surface + Trust Operations Center. This document is the single
source of truth for what the UI shows, what it never shows, and how it maps to
the frozen API contracts.

---

## 1. Product context

ReturnShield is a trust and risk intelligence layer for e-commerce platforms.
It is not a marketplace. The web application contains two surfaces:

| Surface                 | Route          | Audience                             | Shows                                                     |
| ----------------------- | -------------- | ------------------------------------ | --------------------------------------------------------- |
| Mock Marketplace        | `/marketplace` | Seller + customer (integration demo) | Listing outcomes, return request status                   |
| Trust Operations Center | `/ops`         | Reviewers                            | Risk scores, signals, evidence, AI explanation, decisions |

### Information boundary (hard rule)

- Sellers see only: listing approved / correction required (+ issues to fix).
- Customers see only: request received / under review / final decision.
- Risk scores, seller history, policy contributions, and AI reasoning are
  internal to the Operations Center. Never rendered on marketplace surfaces.
- Language: "needs review", "elevated risk". Never accusations of fraud.

---

## 2. Design system

Existing tokens in `apps/web/src/styles.css` (light/dark, spacing, radius,
accent) are the base. Add risk semantics:

- Risk levels: low → `--ok` (green), medium → `--warn` (amber), high → `--danger` (red).
- Score: large number + 0–100 bar, colored by level.
- Status badges (pill):
  - `PASS`, `AUTO_APPROVE` → green
  - `CORRECTION_REQUIRED`, `NEEDS_REVIEW` → amber
  - `priority: HIGH` → red
  - `OPEN`, `RESOLVED`, `PROCESSING` → neutral
- Keep accessibility: skip link, semantic HTML, aria labels, focus-visible.

---

## 3. Marketplace surface

### 3.1 Seller — listing submission (exists, polish)

Form fields: `listing_id`, `seller_id`, `title`, `description`, `category`
(APPAREL / ELECTRONICS / HOME). Submit → `POST /v1/listings/analyze` with a
fresh `Idempotency-Key`.

Result card:

- `PASS` → green: "Listing approved · Risk: Low · Your listing can be published."
- `CORRECTION_REQUIRED` → amber: "Listing needs correction" +
  - issues from `analysis.issues[]` (e.g. "New and used condition claims conflict")
  - evidence quotes from `analysis.evidence[]` (field + quote)
  - `analysis.recommended_action`
  - "Resubmit" action that sends a **new** idempotency key.

### 3.2 Customer — return request (new)

Form: order id → reason (enum below) → optional evidence text.
Submit → `POST /v1/returns` with a fresh `Idempotency-Key`.

Reasons (frozen enum): `NOT_AS_DESCRIBED`, `DAMAGED`, `WRONG_ITEM`,
`NOT_RECEIVED`, `CHANGED_MIND`.

Three public states only:

1. Received: "Return request received · Case ID: … · Status: Processing"
2. Approved: green — "Return approved. Please follow the return instructions."
3. Under review: neutral — "Your return request is under review. We will update
   you when a decision is available."

Declined (final): "Return declined. Reason: The return request did not meet the
return policy requirements." — generic policy copy, **never** the reviewer note.

Idempotency: `ReturnResponse.data.replayed` indicates a replayed request; the UI
must not create a duplicate and should show the same result.

### 3.3 Customer — track return (new)

Lookup by case id → `GET /v1/cases/{id}`. Render only public status/decision.
Never render scores, contributions, or explanation.

---

## 4. Trust Operations Center

### 4.1 Overview (`/ops`)

`GET /v1/dashboard/summary` → metric cards:
flagged listings, auto-approved returns, normal review cases, high review cases,
open review cases (primary), missing context cases. Show `as_of` timestamp and a
shortcut list of open review cases.

### 4.2 Risk Queue (`/ops/cases`)

`GET /v1/cases` with query filters (all optional, frozen `CaseQuery`):
`limit`, `cursor`, `status`, `priority`, `decision`, `seller_id`, `review_status`.

Table columns: Case ID · Score (colored, mini bar) · Priority badge · Seller ·
Listing · Reason · Decision badge · Review status · Updated at.
Default sort: score descending. Row click → case investigation.
Pagination via `next_cursor`.

### 4.3 Case Investigation (`/ops/cases/:id`)

`GET /v1/cases/{id}`. Layout top to bottom:

1. **Header**: case id, status, priority badge, decision badge, big risk score.
2. **Contributing signals**: five bars (seller 30 / listing 25 / customer 20 /
   return 20 / category 15), each showing `contribution / max`, the rule reason,
   and links to its evidence refs.
3. **Evidence**: `evidence[]` grouped by kind (SELLER_HISTORY, LISTING_CONTENT,
   CUSTOMER_HISTORY, ORDER_RECORD, CATEGORY_POLICY, RETURN_STATEMENT), each with
   text and timestamp.
4. **AI Investigator** (only when `explanation_status: AVAILABLE`): summary,
   factors, recommended action. Labeled as AI-generated, evidence-grounded.
5. **Timeline**: `timeline[]` events (RETURN_RECEIVED → POLICY_DECIDED →
   REVIEW_REQUESTED → EXPLANATION_AVAILABLE → REVIEWER_DECISION), timestamp +
   actor.
6. **Listing panel**: `GET /v1/listings/{listing_id}` — content, ListingGuard
   status, contradictions, severity, correction guidance.
7. **Decision controls** (only when `review_status: OPEN`):
   `POST /v1/cases/{id}/decision` with `{ expected_revision, action, note }`.
   - `expected_revision` = the case's current `revision` (optimistic concurrency).
   - Handle `REVISION_CONFLICT` (someone else decided first) with a clear message
     and refresh.
   - When resolved: show disposition card (action, actor, note, decided_at).

### 4.4 Seller Profile (`/ops/sellers/:id`)

`GET /v1/sellers/{id}`: trust score, listing flags, return rate, dispute count,
case history. Drill-down from the queue.

---

## 5. API client additions (`apps/web/src/api/client.ts`)

Typed, contract-validated functions (pattern: `assertValid<T>(definition, payload)`):

| Function                      | Endpoint                       | Definition                             |
| ----------------------------- | ------------------------------ | -------------------------------------- |
| `getCases(query)`             | `GET /v1/cases`                | `CasesResponse`                        |
| `getCase(caseId)`             | `GET /v1/cases/{id}`           | `CaseResponse`                         |
| `getSeller(sellerId)`         | `GET /v1/sellers/{id}`         | `SellerResponse`                       |
| `getDashboard()`              | `GET /v1/dashboard/summary`    | `DashboardResponse`                    |
| `postDecision(caseId, input)` | `POST /v1/cases/{id}/decision` | `DecisionRequest` / `DecisionResponse` |
| `createReturn(input)`         | `POST /v1/returns`             | `ReturnRequest` / `ReturnResponse`     |

POSTs carry a fresh `Idempotency-Key` header. Types mirror the frozen schemas;
runtime authority stays with the generated validators.

---

## 6. Component architecture

```
apps/web/src/
  api/client.ts            ← extended with the functions above
  components/              ← shared: Badge, ScoreGauge, SignalBar, EvidenceList,
                              Timeline, DecisionPanel, MetricCard, DataTable,
                              EmptyState, ErrorState
  features/
    listing/ListingGuardForm.tsx   (exists — polish result card)
    returns/ReturnForm.tsx         (new)
    returns/TrackReturn.tsx        (new)
    ops/Overview.tsx
    ops/RiskQueue.tsx
    ops/CaseDetail.tsx
    ops/SellerProfile.tsx
  routes/                  ← MarketplaceRoute, OpsRoute with nested routes
                              (/ops/cases/:id, /ops/sellers/:id)
```

---

## 7. Engineering standards (non-negotiable)

- **No fixtures in the UI.** `fixtures/api.ts` is test-only. Components call the
  real API client exclusively.
- **Contract-validated responses** at the client boundary; malformed payloads
  fail explicitly (`ApiError` kinds: network / timeout / http / contract).
- **Every screen handles loading, error, and empty states.**
- **Idempotency keys** on all POSTs; `expected_revision` on decisions.
- **Tests**: Vitest + Testing Library for each screen (setup exists).
- **Repo standards**: TypeScript strict, ESLint, Prettier, `npm run verify`.
- No `ComingInPhase` placeholders in the final product.

---

## 8. Build order

1. API client functions + types (unblocks everything)
2. Risk Queue
3. Case Investigation (the demo-winning screen)
4. Overview
5. Seller Profile
6. Marketplace return flow + track return
7. Polish + full `npm run verify` pass

---

## 9. Out of scope (this iteration)

- What-if simulator (not in the frozen API contract; report lists as optional).
- Cognito/auth, WAF, production hardening (backend roadmap).
- Multimodal listing checks, learned risk models (post-hackathon roadmap).
