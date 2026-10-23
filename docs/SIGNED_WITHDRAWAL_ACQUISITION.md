# Signed transfer permission and withdrawal boundary

FACT — the earlier account-authority experiment already tests approved/operator non-owner withdrawal rejection. This increment adds signed transaction-body and receipt evidence to the existing two-branch acquisition experiment; it does not change the contracts or specification.

Immediately before each successful delegated NFT transfer, B signs a withdrawal of one unit from account 1 at its current epoch 0 while A still owns it. On the left, B has only token approval; on the right, B has only owner-wide operator permission. Both withdrawals fail. Each local dry call returns `NotAccountOwner()`, the signed receipt records status 0 with no logs, and the runner checks identical before/after accounting. The subsequent permitted NFT transfer succeeds in each branch. Existing later owner withdrawals also succeed.

The signed capture contains 38 local submissions, with synthetic gas/token fixtures, no impersonation, and no remote provider. The original contracts and acquisition helpers remain unchanged. Five new regressions check scope, the two authorization boundaries, receipt-status tampering and caller-label tampering. The full suite passed 1178/1178 tests across 65 files.

The joint projection is 678,294 bytes, SHA-256 `eb6b3150255e0340d5b6afe487215c41380abf75b29a87d6637a65212d158a6a`. Raw execution records are retained privately. The projection helper does not independently replay the raw transcript. [Validation record](../evidence/SIGNED_WITHDRAWAL_TEST_RESULTS.json).

## Reproduce

Calculate SHA-256 of this experiment's input manifest and use the established guarded Windows environment with a new output path:

```text
python experiments/paid-signed-withdrawal-acquisition/run_signed_withdrawals.py --anvil PATH_TO_PINNED_ANVIL --output NEW_RAW.json --expected-input-sha256 INPUT_MANIFEST_SHA256
python experiments/paid-signed-state-acquisition/extract_joint_capture.py --input NEW_RAW.json --sha256 NEW_RAW_SHA256 --output NEW_JOINT.json
node --test tests/paid-signed-withdrawal-acquisition.test.mjs
```

The regression reads the committed projection. Check fresh branch objects through `inspectPaidRegistryStateHistory`; fresh timestamps/hashes may differ.

INFERENCE — for this pinned fixture, NFT transfer permission alone is insufficient for direct withdrawal before ownership changes. A delegate able to transfer the NFT to itself can subsequently become the owner; this is not a guarantee against that ownership change. The earlier account-authority experiment explicitly covers that distinction.

UNRESOLVED — receipts commit failure status, not the revert reason. Accounting observations remain local; these checks do not establish EVM execution proof, consensus, finality, current public-chain authority, or production acceptance. Paid posting signatures, contract wallets and callback behavior need their own scoped evidence. Next reconcile the paid-action signature checks and contract-wallet roadmap before adding another experiment.
