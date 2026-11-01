# Native call touch path — source observation, not runtime proof

This extends [the database commit review](NATIVE_COMMIT_REVIEW.md). The retained direct-call fixture disagrees with the independent replay about whether the empty native account exists. The temporary one-leaf diagnostic still is not an acceptable execution fix.

## Observed source path

The reviewed versions are revm-handler 42.0.1, revm-context 42.0.0 and Foundry commit `982849d3140c01fd3b72905759581a132df7aa98`. The two crate archive checksums were rechecked against the previously retained lockfile pins, and the inspected extracted files were compared byte-for-byte with their archive members.

1. [execution.rs](https://docs.rs/revm-handler/42.0.1/src/revm_handler/execution.rs.html), line 119: the ordinary transaction-call initializer supplies `CallValue::Transfer(tx.value())`.
2. [frame.rs](https://docs.rs/revm-handler/42.0.1/src/revm_handler/frame.rs.html), lines 184–211: the frame applies the transfer before invoking the precompile. A successful precompile result commits the checkpoint; the error branch reverts it.
3. [journal/inner.rs](https://docs.rs/revm-context/42.0.0/src/revm_context/journal/inner.rs.html), lines 459–476: for distinct caller and target, a zero-value transfer touches the target and returns. Lines 354–358 record the touch and set its flag. The earlier same-address branch returns separately, so this is not a universal assertion about every zero transfer.
4. [Anvil executor.rs](https://github.com/foundry-rs/foundry/blob/982849d3140c01fd3b72905759581a132df7aa98/crates/anvil/src/eth/backend/executor.rs), lines 401–440: the transaction commit method takes the returned state, builds the receipt, optionally records a clone, then passes that state to the database. No empty-account filtering is visible in this method.
5. That executor also invokes post-execution transitions at block completion (line 451). The observations above do not establish that every later state transformation has been excluded.

**INFERENCE:** the reviewed default call path supplies a plausible origin for the touched flag assumed in the previous database-boundary hypothesis. Together with the reviewed CacheDB behavior, it explains a candidate route to retention. It does not establish that the captured binary used this exact path, journal implementation, configuration or flags.

## Required discriminating observation

Use the same signed direct-call input and London configuration. Preserve the existing proof fixture and mismatch; do not patch the community adapter to manufacture agreement.

An instrumented reproduction must record the target's existence, nonce, balance, code hash, touched/created/selfdestructed/loaded-not-existing flags at each of:

- after target loading and before the zero-value transfer;
- after the transfer;
- after successful precompile completion;
- after journal finalization and immediately before database commit;
- after database commit and after block completion.

Capture the final account proof and root as well as the transaction receipt. Retain compiler identity, complete dependency lock, source commit, patch and binary hash. A source-built binary must first reproduce the unmodified fixture before its instrumentation is used to explain the original binary.

Stop short of a root-cause claim if the target never becomes touched, the call uses another implementation, a later stage clears it, or the unmodified rebuild does not reproduce the discrepancy. Investigate that divergence instead of weakening verification.

The direct CacheDB Rust harness remains a smaller unexecuted experiment. It cannot replace this call/journal-boundary observation because it supplies flags itself. Hosted CI remains deferred. No new Rust execution, Anvil capture, full-suite result or production acceptance is claimed here.
