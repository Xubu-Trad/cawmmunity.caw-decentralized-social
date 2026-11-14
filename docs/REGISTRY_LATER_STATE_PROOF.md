# Later registry state reconciled with signed history

FACT — the independent28-operation reader now exposes final registry owners, epochs, single-token approvals and operator permissions. Compiler-layout-derived expectations are compared against16 storage proofs from the retained Geth final allocation. The complete state trie reconstructs Geth's final root before proofs are built. Expected values come from signed-history reconstruction, not the supplied storage values.

Account2 belongs to the new owner at epoch3, its single-token approval is zero, and payer/new-owner NFT balances are3/1. Accounts1,3,4 remain with the payer. All four single-token approvals are zero. **The new owner's two operator permissions, granted to the test token and test helper, remain true.** A cleared token approval is not revocation of operator permission. No revocation occurred in the history and none is inferred.

Reverted callback ownership changes do not survive in either the reconstructed state or final storage proofs. Successful safe-receiver forwarding advances epoch twice. The final header fixture commits the last withdrawal transaction/receipt and the final Geth state root. It is newly assembled and synthetic, not a mined header or a proof of parent linkage to the earlier initialization header.

## Reproduce

First generate and inspect the independent model (existing pinned dependencies/reference readers):

```sh
node --max-old-space-size=256 integration/core-baseline-v1/reconstruct-registry-later.mjs evidence/registry-withdrawal-verification-20261109/input evidence/registry-later-20261109/input-pins.json
```

Its saved output is pinned for the proof comparison:

```sh
node --max-old-space-size=256 integration/core-baseline-v1/check-registry-later.mjs evidence/registry-selection-20261109/manifest.json 33673024dbf0d57084e36cd62e8b9518f3fc6c346cf1807a71ba8b07e690a56a evidence/registry-later-20261109/evidence.json 0x980ebcb3a8ff6093c46c5774425a8001f1d7d872cb79836f49f7a38f6bcddea7 evidence/registry-withdrawal-verification-20261109/input/compiler-input.json evidence/registry-later-20261109/model.json 8ee9b87281b20a657724aadbcc3a625f867141499d2c365c9c1876595d4e675c
```

Use Node20.20.2, solc0.8.30 and ethers6.16.0. Model hashes identify the retained output, not external approval. Do not replace the model with values copied from the proof and treat agreement as independent reconstruction.

## Evidence boundaries

The reader retains eight altered-history rejection checks. The final proof adapter rejects16 alterations, including stale epoch and falsely revoked operator claims. It checks four owners, four epochs, four single approvals, two balances and the two recorded operator grants. This does not enumerate all possible mapping keys.

The public-chain trust anchor, finality and valid chain continuity remain unresolved. No new EVM execution, production acceptance or policy adoption is claimed. The new work reconciles the earlier28-operation model and retained second-engine state. Next work should make the complete reproduction path independently runnable and evaluate authenticated acquisition, rather than relabeling synthetic headers as a live chain. README updates remain paused.
