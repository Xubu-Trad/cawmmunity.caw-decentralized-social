# Read-only access to selected parent-state witnesses

FACT — nine focused tests and 1215/1215 offline Node tests across 70 files passed. [Validation record](../evidence/WITNESS_STATE_TEST_RESULTS.json).

FACT — `createWitnessState(text)` accepts the raw `caw-replay-input-binding/1` JSON string and re-runs the composed proof and transaction-parent checks before constructing its private lookup tables. It does not accept a saved verification report.

The returned interface exposes `account(address)`, `code(address)` and `storage(address, key)`. Addresses must be lowercase 20-byte hex strings and storage keys lowercase 32-byte hex strings. Missing accounts and unselected slots throw errors. There is no network fallback, implicit zero value, write operation or caller-supplied resolver. Account records and the returned interface are frozen; lookup maps remain private.

INFERENCE — refusing missing reads prevents a future execution adapter from silently replacing missing evidence with assumed state through this interface. It does not establish that the supplied dependency set is complete, or that an execution engine will use the interface correctly.

The fixture retains the existing synthetic-child boundary: it is not an observed executable block. Parent-state proofs alone do not establish pre-transaction state, including fork-specific system transitions. No EVM execution, contract-wallet authorization, trusted chain selection or production acceptance is established.

UNRESOLVED — independently exercise a fork-aware execution adapter, missing-read propagation and system transitions. Account absence proofs and state mutation are outside this read-only interface.

Reproduce the focused checks with `node --test tests/witness-state.test.mjs`. Tests cover selected reads, missing accounts and slots, immutable output, malformed selectors, extra arguments, corrupted input and explicitly limited claims.
