# Operator-reference genesis comparison — 2026-11-07

Status: research-only.
Parent: 675da9c9832aeac9ac7c0c2004e5fa5bcf505dfe.

## FACTS

An operator-reference boundary probe compared a retained fixture reference with an internally consistent synthetic provider claim.

The original fixture passed. A modified provider genesis root with recomputed fork digest and metadata SHA-256 passed the existing consistency checks but failed comparison against the unchanged operator reference.

Tampering with operator-reference bytes while retaining the original expected SHA-256 also failed.

The reusable operator-genesis-reference.mjs module enforces the reference schema, SHA-256 equality, exact fixture network designation and full genesis-root equality.

The Ubuntu test groups passed separately:

- New operator-reference tests: 6/6
- Retained-genesis regression: 2/2
- Fork-data regression: 13/13

Source bytes, preserved logs, the synthetic claim and the original boundary probe are recorded in the adjacent evidence manifest.

These focused runs used Node v20.20.2. The repository declares Node v24.20.0, which was not used for these runs. The complete suite was not rerun.

## INFERENCE

The comparison prevents the tested caller-side substitution when the operator's expected SHA-256 remains unchanged.

It does not authenticate who established that hash. Replacing both the reference bytes and the expected SHA-256 can invalidate the claimed independence.

The operator record derives from the minimal Capella test fixture, not from independently authenticated live-chain evidence.

## IDEA

A separate future policy must specify supported network identity, independently justified checkpoint provenance, retention and weak-subjectivity freshness before any live trust decision.

Provider counts, matching short fork digests and self-declared authority fields must not become automatic trust mechanisms.

No BLS validation, finality, update acceptance, production readiness or public-test clearance is claimed. Hosted CI remains deferred.
