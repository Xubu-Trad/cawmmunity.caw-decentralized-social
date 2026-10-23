# Signed approval grant and revocation capture

FACT — a new local signed run extends the existing joint collector with token approvals and owner-wide grants. The unchanged history/state verifier accepts both executed endpoints: the left branch has a nonzero token approval and a true selected operator grant; the right branch has a cleared approval and an explicitly revoked operator grant.

The common prefix contains A's token approval and operator grant to B. The left branch transfers the NFT from A to B, then B grants token/operator permission to A. The right branch self-transfers A's NFT, explicitly clears its token approval and revokes B's operator grant. The branch endpoints are at the same height with different hashes. Five successful registry mutations are replayed per branch in signed transaction order. Both transfer calls are made by their current owner: this experiment does not establish delegated-transfer or post-revocation transfer enforcement.

The existing pinned signed writer, collectors, proof-scope adapter and resource limits are reused unchanged. There were 28 signed local submissions, no impersonation and no remote requests. Gas balances and the token are synthetic fixtures. Registry/probe deployment is through signed local transactions. No public-chain claim or production broadcast is made.

## Verification

Seven Node cases cover fixture scope, each branch, grant/transfer/revocation order, same-height branch-proof substitution, forged or missing operator witnesses, and a changed approval caller. A matching endpoint cannot excuse a signature/body discrepancy. The existing state proof reader derives the nested owner/operator slot from the proved owner. Full suite: 1165/1165 across 63 files.

The public joint projection is 588,866 bytes, SHA-256 `c9be9a63dc4d50ee6832a9661198f65a054c5eee90a66e597a82d008ab54289a`. It retains original observed state roots, signed body bytes, receipts and proofs from this run. Raw request logs are retained privately; the unchanged projection helper is not an independent transcript replay. The public verifier checks the projected commitments and signatures.

## Reproduce

On the established guarded Windows environment, calculate the SHA-256 of the new experiment-inputs.json, then:

```text
python experiments/paid-signed-approval-acquisition/run_signed_approvals.py --anvil PATH_TO_PINNED_ANVIL --output NEW_RAW.json --expected-input-sha256 INPUT_MANIFEST_SHA256
python experiments/paid-signed-state-acquisition/extract_joint_capture.py --input NEW_RAW.json --sha256 NEW_RAW_SHA256 --output NEW_JOINT.json
node --test tests/paid-signed-approval-acquisition.test.mjs
```

Output files must be new and parents must exist. The Node test checks the retained fixture; verify a fresh projection by passing its branch objects to `inspectPaidRegistryStateHistory`. Timestamps and block hashes can vary between executions. See [validation hashes](../evidence/SIGNED_APPROVAL_TEST_RESULTS.json).

UNRESOLVED — independent/public anchor authenticity, consensus/finality/freshness, contract wallets and callback execution. Authority and execution acceptance flags remain false. This closes positive/revoked selected-grant state coverage only for the local fixture. Next: isolate signed token-approved and operator-authorized transfers and demonstrate that revoked delegates cannot transfer, without changing core manifesto policy or equating transfer approval with paid-action/withdrawal authority.


[Isolated signed delegated transfers](SIGNED_DELEGATE_ACQUISITION.md) now cover token approval, operator permission and revoked failures. Spending/withdrawal authority remains separate.
