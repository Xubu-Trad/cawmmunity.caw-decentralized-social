# native account lifecycle: replay cleanup traced

FACT -- a forwarding diagnostic around the unchanged state manager records native-account operations and execution-frame checkpoints without changing arguments or return values. the restored call produces: absent read, empty putAccount, later existing-account read, then deleteAccount from Journal.cleanup. the rejected call never reaches the native account. assertions verify touch-before-deletion and cleanup attribution. the diagnostic is bounded to128events and emits no personal paths.

the installed journal.js cleanup implementation checks the selected hardfork, visits touched accounts and deletes accounts reported empty. runTx.js invokes that cleanup. [Exact inspected file identities and trace](../evidence/NATIVE_LIFECYCLE_RESULTS.json) are retained alongside the repository source hashes; no installed dependency was changed.

[EIP-161](https://eips.ethereum.org/EIPS/eip-161), clauses c/d, specifies that a nonexistent account must not become existent-empty and that touched empty accounts are deleted at transaction end. its addendum requires deletions to roll back with reverted state.

INFERENCE -- the observed deletion is an explicit selected-engine cleanup action consistent with that rule, rather than an unexplained adapter rollback. this does not identify why the captured child trie contains an empty account, or certify either engine's complete consensus behavior. the capture path, proof construction and native-call handling still need isolation.

the existing result remains mixed: receipt/gas and earlier selected values agree, but restored-success nativeChildAccountMatches and completeSelectedChildAgreement remain false. eighteen boundary groups pass and missing-wallet-mode evidence rejects in both cases. a passing harness exit asserts the documented discrepancy. no full suite, new acquisition, full state-root computation or production acceptance is claimed.

## reproduce

```text
node --max-old-space-size=256 experiments/execution-engine/wallet-native-replay.mjs . experiments/paid-wallet-state/witnesses.json
```

use the existing pinned engine installation. [Harness](../experiments/execution-engine/wallet-native-replay.mjs), [retained mismatch](NATIVE_CLEANUP_MISMATCH.md).

NEXT -- isolate the acquisition side with a fresh minimal native-signature call under the same pinned node/fork, selected parent/child headers and account proofs. separate direct-call and contract-mediated cases; vary one factor per experiment. compare proof-backed existence, not zero-valued metadata alone. preserve any mismatch and do not skip cleanup or fabricate an account to fit the capture. a second implementation or independently produced fixture is needed before assigning the root cause.
