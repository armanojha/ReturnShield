# Image evidence handoff

## Delivered

- Additive HTTP, entity and AI schemas with generated validators and an independent additive hash manifest.
- Nullable `size_bytes`, `width` and `height` while an upload is pending, plus durable upload expiry.
- `ImageEvidenceRepository` using the existing table and subject indexes; no raw image bytes in DynamoDB.
- Five-minute server-owned presigned uploads and downloads, JPEG/PNG magic-byte checks, 5 MiB cap and 32–4096 px dimension checks.
- Amazon Nova Lite image analysis through Bedrock Converse with strict output, evidence-reference and prohibited-inference validation.
- Six API routes with scoped upload/completion idempotency and subject existence checks.
- A private encrypted, versioned, TLS-only S3 bucket with seven-day lifecycle, a dedicated Lambda, least-privilege data/S3 access and model-scoped Bedrock permission.
- Focused validation, repository, idempotent lifecycle and CDK assertions.

No UI files were changed. The Operations Center and e-commerce integrations can consume the six endpoints after the backend is deployed.

## Verification completed

- `npm run verify` — passed.
- `python product/verify_contracts.py` — passed: 472 checks and seven schema bundles.
- Focused image service, image analysis, data repository and infrastructure tests — passed.
- CDK synthesis — passed as part of `npm run verify`.

`npm install` required `--force` on the development machine because the repository declares Node 20 while the machine runs Node 22. The lockfile now contains both new workspaces and their AWS SDK dependencies. AWS has already ended Node 20 support in the deployment toolchain, so the repository engine and Lambda runtime should be upgraded separately.

## Live AWS gate still required

Deploy with the existing staged GSI setting, capture the new bucket and function outputs, then exercise valid upload, download, type spoofing, invalid dimensions, expiry, duplicate requests, clean image analysis and contradictory image analysis. Verify that image processing never changes return score, decision, priority or contributions. Only synthetic images may be used.
