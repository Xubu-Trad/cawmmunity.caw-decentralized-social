# Contiguous local registry acquisition

FACT — a fresh, unforked Anvil chain mined the retained 28 signed fixture transactions in 28 consecutive blocks. The capture includes genesis, complete transaction bytes and receipts, final account/storage proofs and runtime code. Genesis funded disposable test accounts; there was no impersonation or state/code injection after startup. The node was stopped after capture.

The existing execution-header reader accepts the selected Shanghai header sequence and parent links. All retained transaction bytes, receipt statuses and log contents equal the earlier independently reconstructed fixture inputs. This comparison is not an assertion that every block's commitments passed verification.

## Exact verification boundary

- 26 of 28 blocks pass transaction/receipt commitment and sender verification.
- Zero-based operation indices 6 and 10 contain transactions of 33,230 and 33,231 bytes. Both reject with `BLOCK_TRANSACTIONS_TRANSACTION_ENCODED_LIMIT`. The reader limit was not changed. Those two blocks remain unverified by the body reader.
- 15 of 16 selected final registry fields pass header-bound account/code/storage proof verification and equal the earlier reconstructed ownership/approval model.
- `approved2` rejects with `ETH_PROOF_STORAGE`. No RPC value substitutes for the rejected proof. Its cause remains to be established for this capture; earlier zero-proof findings are not automatically a diagnosis.
- Missing-block, reordered-block, changed-receipt and changed-body controls all reject.

`LOCAL_CHAIN_ACQUIRED_VERIFICATION_GAPS` is an incomplete result. The offline verifier exits successfully when it reproduces this bounded report, not when full chain acceptance is established. Consumers must inspect the status and rejection arrays. No consensus, public-chain authentication or finality is claimed. Captured start/end hashes select this local experiment only; they are not independent public trust anchors.

## Offline reproduction

Use Node 20.20.2 and the repository's existing reference-reader dependencies. From the pinned draft checkout:

```sh
node --max-old-space-size=256 integration/core-baseline-v1/verify-contiguous-registry.mjs evidence/registry-contiguous-20261109/capture.json evidence/registry-withdrawal-verification-20261109/input/operations.json evidence/registry-later-20261109/result.json
```

Compare the output with `evidence/registry-contiguous-20261109/result.json`. Published provenance records SHA-256 and byte lengths. This verifies saved evidence offline; it does not contact a provider or recreate mining. The retained local acquisition used chain ID 31337, Shanghai, genesis timestamp 1, base fee 1, and Anvil SHA-256 `1eaa28361b8ef92f80a0eaf4f1d90e42744e07e79a3bee5de95e178c8aeedf`. Header timing need not be byte-identical in a fresh mining run.

## Next bounded work

First independently characterize the rejected storage proof and review the transaction size boundary with negative/resource tests. Do not increase limits simply to obtain a green report. Preserve this capture and its failures. Then complete the public, portable acquisition runner and link the verified history to an independently selected network checkpoint with an explicit consensus/finality trust model. The earlier synthetic pipeline remains separate and unchanged.
