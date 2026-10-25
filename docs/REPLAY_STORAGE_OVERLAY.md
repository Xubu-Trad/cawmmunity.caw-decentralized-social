# Bounded storage overlay over verified witnesses

FACT — `createReplayStorageOverlay(rawText)` re-verifies the raw witness input through the read session. It supports reads and writes only to selected proven storage slots of existing accounts. Every read/write first checks the backing witness. Missing slots cannot be created by writing to them. Values must be canonical lowercase hexadecimal quantities no larger than256bits.

`storage` returns the current overlay value; `originalStorage` always returns the verified starting value. `checkpoint` starts a nested frame. `commit` incorporates that frame into its parent. `revert` discards it. A child commit remains reversible by the enclosing frame. `discard` closes the whole attempt permanently. Root commit/revert underflow rejects. There are at most16nested frames and256written slots per snapshot; these are experimental resource bounds, not protocol limits.

Any invalid access, operation or exhausted bound invalidates the attempt. Revert is permitted for cleanup after failure but cannot clear the failure marker. There is no reset. State values are immutable strings and maps stay private. A fresh overlay re-verifies the original evidence and contains no earlier writes.

Eleven focused regressions and1232/1232 offline tests across72files passed. [Validation record](../evidence/REPLAY_STORAGE_TEST_RESULTS.json). Focused command: `node --test tests/replay-storage-overlay.test.mjs`. Checks include original-value preservation, nested revert, child commit followed by parent revert, zero writes, missing-slot writes, malformed values, depth exhaustion, underflow, discard and extra arguments. The256slot ceiling is not separately exercised by the four-slot fixture.

INFERENCE — this supplies a bounded reversible storage component for the forthcoming engine adapter. It does not establish correct EVM SSTORE gas/refund behavior, original-storage cache integration, nested engine writes or transaction rollback. The starting state is parent-bound evidence, not proven pre-transaction state. The synthetic child remains unsuitable as a successful execution oracle.

UNRESOLVED — account balance/nonce journaling, account absence/creation, code writes, state-root updates, engine integration and signed replay. No RPC fallback, admin authority, production acceptance or wallet-authority conclusion is added. Next connect this component to the pinned engine and independently test nested SSTORE commit/revert while keeping missing-evidence failure outside reversible state.


The [existing-account extension](REPLAY_ACCOUNT_OVERLAY.md) now journals bounded nonce/balance updates in the same frames. Earlier storage-only scope and validation above remain historical. Code/root updates and account creation are still unsupported.
