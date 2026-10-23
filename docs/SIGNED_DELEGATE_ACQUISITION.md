# Signed delegated-transfer enforcement

FACT — the joint signed local experiment now isolates token approval and owner-wide operator authorization. It reuses the unchanged registry, signed writer, proof scope and history/state verifier. No contract or manifesto policy changes were made.

Both branches start from A owning account 1 and granting B token/operator permission. The left branch disables the operator grant, clears the token approval, submits B's transfer and observes failure, then grants only token approval and submits B's successful A-to-B transfer. The right branch clears token approval, revokes the operator grant, submits B's self-transfer and observes failure, then grants only operator permission and submits B's successful A-to-A transfer.

Reconstruction identifies the successful calls as `token-approval` and `operator`, respectively. It checks that the caller differs from the owner and that the alternative grant was disabled before that transfer. Each branch includes eight successful registry mutations and one failed registry call. Successful transfers increase epoch to 1; the failed attempts emit no logs. Later endpoint grants/revocations remain as in the preceding approval experiment.

## What is verified

The 36 submissions use published test identities and signed local envelopes, with no impersonation or remote requests. Gas balances and the installed token runtime are synthetic fixtures. The original local endpoint proofs agree with the reconstructed owner/epoch/token approval/selected operator state. Both branch tips share a height but differ in hash; swapping proofs is rejected.

The local dry calls returned the expected `NotAuthorized()` error before the signed failed transactions were submitted. The public receipt evidence commits failure status and empty logs, **not a revert reason**. The history reader retains `failedCallsNotPermissionChecked: 1` and does not infer a failure reason or execution proof from receipts. Local observed enforcement and cryptographic commitment checking remain distinct.

Eight regression cases cover scope, both isolated transfer paths, grant isolation/order, failed signed receipts, alternate-branch proofs, signer-label changes and relabeled receipt status. Full Node suite: 1173/1173 across 64 files. The joint projection is 662,670 bytes, SHA-256 `2fbe579e35a5b6bf3b83093331138b2a7733a7daafd9cf22473ab483226019c2`; raw logs are retained privately. The projection helper is not an independent transcript replay.

## Reproduce

Calculate SHA-256 of this experiment's input manifest, then use the established guarded Windows environment:

```text
python experiments/paid-signed-delegate-acquisition/run_signed_delegates.py --anvil PATH_TO_PINNED_ANVIL --output NEW_RAW.json --expected-input-sha256 INPUT_MANIFEST_SHA256
python experiments/paid-signed-state-acquisition/extract_joint_capture.py --input NEW_RAW.json --sha256 NEW_RAW_SHA256 --output NEW_JOINT.json
node --test tests/paid-signed-delegate-acquisition.test.mjs
```

Outputs must be new, with existing parent directories. The regression reads the committed projection. Verify fresh branch objects with `inspectPaidRegistryStateHistory`; fresh timestamps/block hashes may differ. [Validation record](../evidence/SIGNED_DELEGATE_TEST_RESULTS.json).

UNRESOLVED — transfer approval is not spending, posting or withdrawal authority. These results do not grant those powers to a delegate. Next: reconcile existing account-custody tests with a signed delegated withdrawal/paid-action negative case before extending authority acceptance. Public/independent anchors, consensus/finality/freshness, contract-wallet/callback scope and production remain open. No authority, execution or production acceptance flag is raised.
