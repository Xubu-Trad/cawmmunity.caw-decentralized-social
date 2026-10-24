# Execution adapter: evidence requirements before integration

Review baseline: community `6c79da9c1b525f4ebf4abfc7b4debb3ff3c051d2`, 2026-10-24. This is a source review and proposed experiment, not an installed engine or successful replay.

## Observed compatibility boundaries

FACT — the current [witness reader](../reference/witness-state.mjs) is immutable and read-only. It rejects missing accounts and unselected slots. It cannot supply execution writes, nested rollback, account creation or state-root updates.

FACT — EthereumJS is one candidate, reviewed at `15eede6fb0721fdf0536ec27e838d137809c99e0`. Its [state interface](https://github.com/ethereumjs/ethereumjs-monorepo/blob/15eede6fb0721fdf0536ec27e838d137809c99e0/packages/common/src/interfaces.ts) requires additional write and checkpoint operations. Its [simple state manager](https://github.com/ethereumjs/ethereumjs-monorepo/blob/15eede6fb0721fdf0536ec27e838d137809c99e0/packages/statemanager/src/simpleStateManager.ts#L70-L108) returns undefined for an unknown account and empty bytes for missing code/storage; its state-root methods throw unimplemented errors. These are ordinary in-memory semantics, not a defect claimed against that library.

INFERENCE — loading only our selected witnesses into that manager would lose the distinction between unavailable evidence and proven empty state. It is not a safe direct replacement for the witness reader.

FACT — the pinned [transaction runner](https://github.com/ethereumjs/ethereumjs-monorepo/blob/15eede6fb0721fdf0536ec27e838d137809c99e0/packages/vm/src/runTx/inner.ts) includes balance/nonce checks and optional bypasses, plus transaction checkpoint/revert handling. Source inspection does not prove that missing-witness errors propagate correctly through every nested execution path. The [package metadata](https://github.com/ethereumjs/ethereumjs-monorepo/blob/15eede6fb0721fdf0536ec27e838d137809c99e0/packages/vm/package.json) identifies version 10.1.3 and MPL-2.0. No package or transitive dependencies were installed, and these source bytes have not been treated as a published package's integrity pin. The project's code-only MIT notice does not relabel third-party code.

## Proposed bounded implementation

IDEA — first target the existing synthetic London profile and transaction index zero. Reject unsupported profiles and transaction types. Keep balance, nonce and block constraints enabled. Select an exact released engine/dependency set, preserve integrity hashes and notices, and inspect its API before implementing against it.

Use the verified witness reader as immutable backing state, with a separate bounded write journal. Preserve original storage for gas accounting. Track known absence separately from missing data; until absence proofs are supported, reject account creation and any read requiring an absent account. Never synthesize sender, recipient or fee-recipient state. Return defensive copies of mutable engine values.

A missing witness must permanently invalidate the replay attempt, even if nested code catches an exception or rolls back a frame. Keep that failure outside the reversible journal; reject the final result regardless of an apparent engine success. Discard the adapter after failure. This is a proposed invariant, not tested integration behavior.

Do not infer a post-state root from a partial map. State-root comparison requires a proof-backed trie update or another independently justified commitment mechanism. Parent commitments also need authenticated chain selection. Later fork system transitions and type-4 authorization require separate implementations and evidence.

## Required experiments

1. Acquire a genuine signed local first transaction with parent account/code/storage evidence, including sender and fee recipient. The existing synthetic-child fixture is unsuitable as a successful execution oracle.
2. Run it offline with networking unavailable and explicit engine/profile pins. Compare status, gas, return data, logs and supported state commitments with the independently retained node observation.
3. Remove one required account, code value or slot at a time. Each run must fail, including a nested-call case where execution would otherwise continue.
4. Exercise journal commit, nested revert and top-level failure separately. A missing-evidence failure must survive all three.
5. Change nonce, balance, chain profile or transaction position individually; retain each rejection. Keep unknown state distinct from authenticated zero/absence.

UNRESOLVED — engine selection and installation, mutable proof-backed state, failure propagation, executable fixture acquisition, independent reproduction and authenticated trust anchors. No new execution test ran for this review. The latest validated suite remains 1215/1215 offline checks; production and public test-candidate gates remain blocked.
