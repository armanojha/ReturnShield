# ADR 0002: Demo-store partner API

## Status

Accepted for the synthetic hackathon deployment.

## Context

The demo e-commerce platform must submit real listings and returns to ReturnShield. The frozen return contract accepts an `order_id`, while the deterministic workflow requires a previously persisted seller, customer, listing and order. Browser code cannot safely hold a shared partner credential.

## Decision

- API Gateway creates one generated API key and usage plan for the synthetic `demo-store` partner.
- Only server-side demo-store routes receive the key. The key is sent as `x-api-key`; it is never committed, returned to the browser or logged.
- API Gateway requires the key for listing analysis, return intake, partner-context synchronization and image upload/completion mutations.
- `POST /v1/partner/context` synchronizes complete frozen `Seller`, `Customer` and `Order` entities after confirming the referenced analyzed listing belongs to that seller.
- Context synchronization requires `Idempotency-Key`, validates every entity with the frozen entity validators, and stores no names, email addresses, addresses or payment data.
- ReturnShield IDs are derived from immutable synthetic Vendure IDs. ReturnShield remains the authority for `case_id`, risk results and reviewer state.
- The Operations Center remains a separate client and never receives the partner key.

## Consequences

API Gateway keys identify a partner application and provide throttling; they are not end-user identity. The demo must not claim Cognito, OAuth, customer authentication or production multi-tenancy. Existing GET reviewer routes remain unchanged for the hackathon and are listed as a known limitation for Phase 09.

The new context endpoint composes existing frozen entities instead of changing any Phase 00 entity, listing, return, policy or AI contract.
