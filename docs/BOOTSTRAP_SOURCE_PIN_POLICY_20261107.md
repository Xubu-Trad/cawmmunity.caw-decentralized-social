# Source-pinned fixture operator policy — 2026-11-07

Status: research-only.
Parent commit: 727040cd06f1a1c8c42af86252a628a7909aa8d4.

## FACTS

The prior dual-repin probe established that a caller can provide internally
consistent synthetic provider metadata and a synthetic operator-reference
record, then supply a matching replacement operator SHA-256. The published
comparator admits those inputs as data consistency, without authenticating
either input's authority.

The new six-argument wrapper removes the caller-supplied replacement
operator hash from this interface. It compares operator-reference bytes
against a fixed SHA-256 embedded in reviewed research source, then calls
the previously published comparator.

The same synthetic dual-repin inputs are rejected by the wrapper.
The original comparator remains unchanged and retains its documented behavior.

The separate Ubuntu test groups passed:

- Source-pinned fixture gate: 5/5
- Existing operator comparator: 6/6
- Retained genesis regression: 2/2
- Fork-data regression: 13/13

Exact source, synthetic inputs, negative probe and four retained TAP logs
are identified by the adjacent machine-readable evidence manifest.

## INFERENCE

The wrapper prevents the tested caller-side replacement of the operator
reference and its expected hash, provided the reviewed source and the
embedded fixture commitment remain unchanged.

This is not an independently authenticated trust root. Code replacement,
an untrusted software distribution path, or the absence of an independently
justified operator policy remain unresolved.

The embedded commitment originates from the same retained minimal Capella
research fixture, not independently authenticated live-network evidence.

## IDEA

Establish explicit independent software and policy provenance before treating
a locally embedded expected hash as an operator-owned security boundary.

Do not infer trust from provider count, a short fork digest, locally generated
hash sidecars or self-described source authority.

Full-suite testing, declared Node 24.20.0 testing, live checkpoint selection,
BLS validation, freshness, finality, update acceptance, production clearance
and public-test clearance are not established. Hosted CI remains deferred.
