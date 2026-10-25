# Pinned-engine writes through the selected-storage overlay

FACT — four scoped checks passed with EthereumJS10.1.3 under London. Injected outer/child code exercises DELEGATECALL and SSTORE through the verified storage overlay. The test asserts that writing1 changes the selected slot's starting value, preventing a no-op rollback test.

1. Successful child execution leaves the new value visible; originalStorage still returns the proven starting value.
2. A child that writes and then executes REVERT returns failure to its parent and restores the prior value through the engine's checkpoint/revert callbacks.
3. A child commit followed by an outer REVERT is undone by an explicitly created enclosing test frame. `runCode` is not `runTx`; the harness owns and reverts this outer frame. This is not proof of transaction-level engine rollback.
4. A child writes and then reads an unproved slot. The original missing-slot error propagates; reverting cannot clear the permanent overlay failure. Discard then closes all access.

[Experiment source](../experiments/execution-engine/storage-write-boundary.mjs) and [validation record](../evidence/ENGINE_STORAGE_WRITE_RESULTS.json). After the existing frozen install, from `experiments/execution-engine`:

```text
node --max-old-space-size=256 storage-write-boundary.mjs ../..
```

The probe wires getStorage, putStorage, checkpoint, commit and revert to the selected-slot overlay. Its original-storage callback returns immutable backing values. Account/code reads use a separately verified read session; account/code writes remain unsupported. Injected code does not claim to match the account's proven runtime. No arbitrary transaction, value transfer, account creation or post-state root is supported.

INFERENCE — these cases demonstrate bounded storage-write integration with actual engine callbacks. They do not independently validate gas/refund accounting, all nested call types, system transitions, or full state-manager semantics. Network isolation was not independently enforced; there are no explicit network requests in the probe. The test adapter is not a production implementation.

The four checks are reported separately from the unchanged1232/1232 offline suite. The suite was not rerun because existing reference/application code was unchanged. Resource guards remained unchanged.

UNRESOLVED — next account balance/nonce journaling and transaction-level checkpoint integration, with negative controls for unauthorized or absent state. Before successful signed replay is claimed, acquire a genuine executable fixture and compare independent transaction results, receipts and supported state commitments. Gas/refund behavior and original-storage lifetime need dedicated evidence. Production and wallet-authority acceptance remain false.
