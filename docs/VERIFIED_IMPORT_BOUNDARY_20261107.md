# Verification-to-import boundary — 2026-11-07

Research only. Parent: `d269c82542c655e25f5485912ec3ad526dbf67b7`.

## FACT

The previous [dependency experiment](DEPENDENCY_SUBSTITUTION_20261107.md) detected altered imports using an unchanged five-file inventory. This experiment fixes the same inventory and isolates the ordering of inspection, mutation and import. It adds tests and evidence only; no production module or recovery loader changes.

Each scenario uses a fresh temporary directory and unique file URL tree, avoiding a cached ESM module masking the change. The only altered code literal is the imported operator comparator's `networkAuthenticated:false`, replaced with `networkAuthenticated:true`. All fixture arguments and other source bytes stay unchanged. The true value is a deliberately false report from the negative control, not authenticated network evidence. Modified code exists only in disposable test directories.

| Scenario | Observed result |
|---|---|
| Inspect original files, then import without mutation | Original unauthenticated result |
| Inspect original files, replace dependency, then import those paths | Corrupted dependency reports true; later inventory comparison rejects |
| Capture the exact buffers inspected, replace acquisition dependency, write and import the captured buffers elsewhere | Entire result equals the original control; acquisition path now rejects inventory comparison |
| Inspect the written snapshot, then replace its dependency before import | Corrupted dependency reports true; later inventory comparison rejects |

The captured-buffer experiment hashes the same Buffer objects it retains and writes, instead of rereading the mutable acquisition paths. It demonstrates resistance only to the tested mutation of those acquisition files. It neither freezes the buffers against an adversary inside the process nor protects the destination from another writer. The destination remains writable; the fourth scenario deliberately demonstrates the surviving gap.

Four new focused tests passed. A separate 40-test regression passed across dependency substitution, source inspection, source policy, operator comparator, retained-genesis and fork-data tests. Node v24.22.1 ran; declared Node24.20.0 did not. Raw TAP, exact commands, binary identity and source hashes are in [the evidence record](../evidence/VERIFIED_IMPORT_BOUNDARY_20261107.json). Tests used the retained partial Git snapshot with verified blob identities. Inputs remained unchanged after execution. Resource guards required 2 GiB free disk and 1 GiB available memory, 256 MiB Node heap, serial execution, 30-second test timeout and a 45-second process deadline per group.

## INFERENCE

A successful check is a statement about the bytes checked, not future reads from the same paths. Rechecking merely moves the available mutation window. Copying captured verified bytes separates this experiment from later acquisition-path changes, but a writable destination, modified runtime/builtins, changed checker or adversary inside the process defeats stronger claims. These deterministic interleavings establish a possible ordering, not measured exploitation probability or a concurrent-race stress test.

This is not a secure loader, sandbox, complete dependency resolver, runtime attestation or independent software distribution. The inventory remains same-operator fixture provenance. File permissions alone would not justify protection against the same privileged actor. No production acceptance or authentication flag has changed in the retained implementation. BLS, consensus, real-network/fork selection, checkpoint provenance/recency and update adoption remain unresolved.

Full suite, declared runtime, build, EVM, live acquisition and CI were not run. Hosted CI remains deferred; earlier immutable evidence, including the additive historical checksum correction, remains unchanged.

## IDEA — next gate

Before another loader implementation, define the execution threat model: who may change acquisition files, destination files, process memory, manifests and runtime; how the operator establishes manifest authority; and what makes the executed module graph the checked graph. Review an isolated execution mechanism against the demonstrated destination-write control. Any candidate must reject unsupported imports and retain runtime/dependency provenance without promising protection against an actor allowed to replace the runtime itself. Keep independent trust-anchor sourcing and consensus/BLS requirements separate. Do not promote fixture byte consistency into canonical authority.

## Reproduce

Run the exact guarded groups recorded in `evidence/verified-import-boundary-20261107/run.json`. The focused command is:

```sh
node --max-old-space-size=256 --test --test-reporter=tap --test-concurrency=1 --test-timeout=30000 tests/verified-import-boundary.test.mjs
```

Tests are registered for future complete runs, not counted as a new full suite. Project-authored tests and explanation follow the repository MIT license; retained third-party fixtures keep their existing notices.
