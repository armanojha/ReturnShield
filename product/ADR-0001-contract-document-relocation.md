# ADR-0001: Place frozen contract documents at repository root

Status: accepted as Phase 01 repository layout work, 2026-09-19.

## Context

Commit `24e244d` moved `docs/contracts/**` to `contracts/**` and `docs/product/**` to `product/**`. Phase 00 had already frozen contract content, so repository tooling needed an explicit record distinguishing a path change from a contract change.

## Decision

Keep the root-level `contracts/` and `product/` layout. Update tooling, documentation and manifest keys to those paths. Preserve every contract file byte and every approved SHA-256 digest. Runtime packages consume generated mirrors and validate the root source against the frozen manifest.

## Consequences

The shorter paths clarify that these files are build inputs rather than general documentation. The Python verifier and schema synchronization script must use the root-level layout. Any future change to contract content remains subject to the Phase 00 ADR and dependent-task review rule. `python product/verify_contracts.py` and `npm run check:schemas` enforce the unchanged baseline.
