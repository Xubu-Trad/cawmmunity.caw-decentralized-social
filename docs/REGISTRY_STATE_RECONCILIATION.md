# Registry replay and selected-state reconciliation

`inspectRegistryStateReconciliation(text)` is a separate, opt-in consistency check. It combines the fixed-fixture direct-call replay with the selected-header owner/epoch proof reader. It does not enable automatic recovery adoption or authorize a paid action.

The exact bounded JSON envelope has schema `caw-registry-state-reconciliation/1`, `sequence`, `registrySelection`, `stateEvidence` and `stateSelection`. The latter four fields use the existing [permission replay](PAID_REGISTRY_PERMISSIONS.md) and [state proof](REGISTRY_STATE_PROOFS.md) formats. Maximum envelope size is 1 MiB; component bounds still apply and duplicate keys reject.

Replay always starts from the explicit constructor-owner assumptions with zero epochs and approvals. It never seeds earlier transaction permissions from the terminal proof. After replay, the registry address and selected account's final owner/epoch must match the code-bound state proof. Success returns `selectedAccountStateMatchesReplay`, plus the unchanged frozen replay and state reports.

## What the evidence establishes

FACT — the retained local executed transfer from A to B reconciles with the acquired B/epoch-1 proof. Substituting B as that earlier transfer's caller fails permission replay. Missing transfers, incorrect constructor ownership, wrong registries and incompatible selected states reject. An equal final owner cannot conceal a different epoch. This run reuses the prior local capture; no new EVM execution is claimed.

FACT — a deliberately constructed operator-grant event can be appended and still match the same owner/epoch proof. The test is an explicit counterexample to treating endpoint owner/epoch agreement as approval verification or proof of complete history. That grant was not observed in the local capture. Approval/operator storage is not part of the selected proof profile.

UNRESOLVED — the input sequence's senders, order and completeness are not authenticated by this function. Constructor state is assumed. Transaction positions, receipt commitments, intervening effects, callbacks and execution require additional evidence. The supplied endpoint also remains unauthenticated. Matching selected state does not establish that either supplied transcript occurred on a canonical chain.

Accordingly, `approvalsStateVerified`, `initialStateVerified`, `sequenceComplete`, `sequenceOrderAuthenticated`, `transactionPositionVerified`, `senderVerified`, `accountAuthorityVerified`, `currentPermissionVerified`, `executionVerified`, `consensusVerified`, `finalityVerified`, `freshnessVerified` and `productionAccepted` remain false. Existing nested flags are not upgraded.

Ten focused tests and 1132/1132 full offline tests across 59 files passed under the existing resource guards. See [recorded hashes and scope](../evidence/REGISTRY_RECONCILIATION_TEST_RESULTS.json).

Next gate: bind a complete ordered transcript to checked transaction/receipt evidence and explicitly cover approval/operator state before considering transaction-position authority. Merely adding more owner/epoch comparisons cannot close that gate.
