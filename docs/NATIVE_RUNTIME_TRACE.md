# Native-account runtime trace: replay-side deletion observed

FACT — A new bounded local run instruments only the standard EthereumJS state-manager methods used by the unchanged selected London executor. The retained signed direct-call fixture is unchanged. The target account is initially absent. The observed target operations are:

1. `getAccount`: absent.
2. `putAccount`: present with zero nonce/balance and empty code/storage hashes.
3. `getAccount`: the empty account exists.
4. `deleteAccount`: removal completes.

Checkpoint/commit operations are retained in the [machine-readable trace](../evidence/NATIVE_RUNTIME_TRACE_RESULTS.json). Events are recorded after each wrapped method completes; this is method-completion order, not a trace of every internal journal mutation. The observer delegates to the original methods without adding state-manager reads or writes, and restores the methods afterward. It caps recorded events at 128.

A separate fresh, uninstrumented state manager replays the same transaction before the traced run. Both runs have identical receipts, gas usage and final roots and leave the target absent. Sender and fee-recipient balance/nonce still match the captured child proofs. The captured native account remains present-empty, so complete child agreement is still false.

INFERENCE — For this replay, native absence is not solely an initial-load shortcut: an empty account is written and later explicitly deleted. This provides a concrete replay-side boundary to compare with the acquisition implementation. It does not identify the caller of each method or prove the acquisition engine's runtime flags, journal path, database commit or final block transitions.

## Reproduce

Use the existing pinned EthereumJS installation and Node 24.20.0:

```text
node --max-old-space-size=256 experiments/execution-engine/native-runtime-trace.mjs experiments/paid-wallet-state/direct-witnesses.json
```

The focused guarded run exited 0 in 11.453 seconds with observed peak process memory 77,754,368 bytes. A successful harness asserts the retained disagreement and observer control, not consensus-correct execution. Source, fixture and output hashes are recorded with the result. The historical 1,248/1,248 offline suite is unchanged; this standalone experiment is not added to that count.

No fresh chain capture, Rust execution, independent operator, complete block validation or production acceptance is established. No account is manually inserted to force agreement. The next discriminating acquisition-side work remains the [load/transfer/finalization/commit trace](NATIVE_CALL_TOUCH_PATH.md), after an unmodified pinned rebuild reproduces the fixture. Hosted CI remains deferred. Preserve both roots and do not relax the verifier.


## Follow-up: cleanup caller observed

A subsequent controlled run retains function labels from the deletion call stack, excluding filesystem paths. The target deletion passes through `Journal.deleteAccount` and `Journal.cleanup`. The harness now checks the complete target-operation sequence and both caller labels. This is observation at the JavaScript state-manager boundary, not Rust journal instrumentation.

The installed EthereumJS 10.1.3 `evm/dist/esm/journal.js` and `vm/dist/esm/runTx.js` bytes were compared with the retained archives after rechecking their SHA-256 and SHA-512 integrity pins. The cleanup method checks the active hardfork and deletes touched accounts which are absent or empty; runTx invokes journal cleanup. [New result, caller labels and source identities](../evidence/NATIVE_CLEANUP_CALLER_RESULTS.json) preserve this run separately from the original trace.

[EIP-161](https://eips.ethereum.org/EIPS/eip-161) specifies transaction-end removal of touched empty accounts and includes zero-value transfers in its touch definition. The observed replay-side deletion is consistent with that rule for this selected London case. This does not certify the entire execution, all precompile edge cases or the acquisition binary. In particular, reverted execution has separate requirements and was not added to this experiment.

The uninstrumented control still matches the traced receipt, gas and root. The acquisition-side mismatch remains. No new chain capture, Rust execution, full-suite run or release acceptance is claimed. Next acquisition-side verification remains blocked on reproducing the pinned build before tracing it; do not change the adapter to manufacture agreement.
