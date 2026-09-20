# ADR 0001: Multimodal image evidence

**Status:** Accepted for the synthetic demo
**Date:** 2026-09-20

ReturnShield accepts synthetic JPEG and PNG evidence up to 5 MiB, with both dimensions between 32 and 4096 pixels. The API creates an opaque `evidence/<uuid>` key and returns a five-minute presigned PUT URL. Clients cannot choose an S3 key. Completion reads the private object, verifies its magic bytes, declared type, size and dimensions, and only then makes it available.

Objects live in a private, public-access-blocked, bucket-owner-enforced, S3-managed-encrypted, TLS-only, versioned bucket. A lifecycle rule expires current and noncurrent objects after seven days. Downloads use five-minute presigned GET URLs. Image bytes and signed URLs are never stored in DynamoDB or written to application logs.

`ImageEvidence` is an additive sidecar stored in the existing table and attached through existing subject indexes. Phase 00 `Listing`, `ReturnCase`, `Evidence`, scores, decisions, priorities and contributions remain unchanged. New contracts use separate schema IDs and a separate additive hash manifest; the frozen Phase 00 manifest remains byte-for-byte unchanged.

Validated bytes are sent to Amazon Nova Lite (`amazon.nova-lite-v1:0`) through Bedrock Converse in the deployment region. Model output is untrusted until it passes the strict `ImageAnalysisOutput` schema, cites exactly the current image ID and passes prohibited-inference checks. It may neutrally describe visible evidence and recommend `NONE` or `FLAG_FOR_REVIEW`. It cannot approve, decline, accuse a person, identify a person, make medical claims, or mutate deterministic policy fields. Failure produces `analysis_status=UNAVAILABLE` while retaining validated evidence.

The new API surface is:

- `POST /v1/images/uploads`
- `POST /v1/images/{image_id}/complete`
- `GET /v1/images/{image_id}`
- `GET /v1/images/{image_id}/download`
- `GET /v1/listings/{listing_id}/images`
- `GET /v1/cases/{case_id}/images`

Upload and completion POSTs use scoped idempotency records. This demo does not claim production authentication or tenant isolation; those controls must be added before real-user data is accepted.
