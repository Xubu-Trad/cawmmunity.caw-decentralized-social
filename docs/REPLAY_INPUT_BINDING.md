# Binding replay proofs to the exact transaction parent

FACT — `inspectReplayInputBinding(text)` composes the existing first-transaction anchor and selected-dependency proof readers. It accepts exact JSON schema `caw-replay-input-binding/1` with `anchor` and `dependencies`. Both raw evidence objects are verified afresh. Saved reports are not accepted in place of evidence.

The selected header profile, parent hash and parent state root must agree. Individually valid proofs for a different branch therefore cannot satisfy the transaction's parent. Input is bounded to1MiB; the existing body, signature, header and proof bounds remain in force. Only transaction index zero is supported by the anchor.

`parentDependencyBindingVerified` is the only new positive claim. `dependencyClosureVerified`, `parentStateAuthenticated`, `preTransactionStateVerified`, `systemTransitionsVerified`, `executionVerified`, `accountAuthorityVerified` and `productionAccepted` remain false. Nested reports retain their original scope. No EVM, provider request, deployment or automatic acceptance is added.

## Synthetic fixture boundary

The fixture generator reuses a retained local parent header and registry proof. It constructs a synthetic child header, retaining an existing signed transaction body and root, then recomputes the header hash with the existing Python header encoder. This is deliberately not a new observed block or a claim that the reused transaction could execute successfully in that state. `syntheticChild: true` and `executionValid: false` are explicit fixture labels. Passing structural and cryptographic input checks is not execution validity.

Six regressions cover the positive binding, independently valid other-branch proofs, a tampered parent root, substituted saved reports, unsupported later positions and injected/duplicate fields. Full1206/1206 Node tests across69files passed. [Validation record](../evidence/REPLAY_INPUT_TEST_RESULTS.json).

```text
python -I -B reference/fixtures/generate-replay-input-fixture.py NEW_FIXTURE.json
node --test tests/replay-input-binding.test.mjs
```

The generator writes only a new output file, uses retained repository inputs and does not contact a node. Compare fresh output bytes with the committed fixture. The code generator is independent of the JavaScript composition but reuses existing Python cryptographic helpers; it is not an independent cryptographic implementation.

UNRESOLVED — next provide a read interface that refuses every undeclared account, storage slot or code access. Such an interface still needs an actual fork-aware execution engine, system transitions, transaction checks and public trust anchors before it can establish execution. Do not substitute assumed zero state or an unchecked RPC fallback for missing dependencies.
