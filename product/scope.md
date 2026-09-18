# ReturnShield — Phase 00 product contract

Schema version: `1.0.0`. Status: approved 2026-09-18; frozen baseline.

ReturnShield is an API and operations system for marketplace trust and returns teams. The mock marketplace is a demonstration client. One React application will expose `/marketplace` and `/ops`; this phase creates no application skeleton.

## MVP flow and acceptance

1. Submit title, description and category to ListingGuard through API Gateway, Lambda and Bedrock. Validate output before persisting a listing in DynamoDB. Show `PASS` or `CORRECTION_REQUIRED`, severity, issues and supplied-content evidence.
2. Submit a return for an existing synthetic order. Atomically reserve `order_id` before starting Step Functions. Replays reuse the case and execution.
3. Fetch seller, listing, customer, order and history; evaluate five deterministic signals. Persist raw total, clamped score, policy version, contributions and evidence. Missing context produces `ERROR_MISSING_CONTEXT`, never an invented score.
4. Scores 0–29 auto-approve; 30–59 require NORMAL review; 60–100 require HIGH review. No automatic rejection. Review events invoke an evidence-only Investigator. AI failure leaves deterministic results intact.
5. Operations reviewers inspect a queue, case, seller context, contributions, evidence, raw/clamped values and explanation; persist a separate reviewer disposition and timeline event.

Acceptance eventually requires these paths on AWS with all three deterministic seed stories. Phase 00 verification demonstrates contract consistency only, not runtime functionality.

## Scope and cut order

Required: Amplify Hosting, API Gateway, Lambda, DynamoDB, Bedrock, Step Functions, CloudWatch logs, least-privilege IAM; nine v1 HTTP operations including health and dashboard summary. Shared types later belong in `packages/contracts`; scoring later belongs in `packages/risk-policy`.

Prefer EventBridge for review events. If it blocks delivery, record the direct Step Functions Investigator fallback and its dependent-task review in an ADR. Add S3 only for actual evidence objects or reports.

Cut first: what-if simulator, WAF, X-Ray, Guardrails configuration, placeholder Secrets Manager, charts, standalone seller pages and design polish. Keep seller API/context, contributions, evidence and reviewer actions. Cognito, agents, AgentCore and advanced search are stretch work. Real marketplace integrations, payments, fulfillment, trained fraud models, multi-tenancy and production analytics are out of scope. No claims of validated fraud detection or unimplemented services.

Synthetic data only; no customer PII, credentials or deployed identifiers. Use “elevated risk” and “needs review.” Authentication is deferred by the source plan; any later deployed demo must restrict mutations to its synthetic sandbox and must not be represented as production-ready.

## Authority and reconciliation

Read from `D:\PROJRCTS\returensheild_vault`: PHASE-INDEX, CODING-RULES, Phase 00–07 task notes and Reference notes. Active phase notes outrank references. The referenced source PDF/project report is absent from the provided vault; the authoritative Markdown and reference summaries are the available source baseline.

- Use 0–29/30–59/60–100; the demo note's `<40` is stale.
- Use uppercase listing statuses; older lowercase examples are superseded.
- Missing context is an explicit error with null score and no deterministic decision. Keep it visible for operations recovery; do not fabricate a normal scored review result from the older fail-safe wording.
- `order_id` is the only return idempotency key. Reservation precedes execution, resolving the older workflow placement ambiguity.
- Concrete signal predicates, reviewer dispositions, paging, AI output details and non-return POST keys below are Phase 00 design proposals, not facts claimed to exist in the vault.

## Change control and approval

The tagged candidate received explicit human approval on 2026-09-18. Phase 01 may now begin. Any schema, threshold, entity, policy or architecture change requires an ADR documenting rationale, compatibility/migration, affected tasks and integrator approval. Feature owners do not merge their own work.
