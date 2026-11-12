# Wallet lifecycle bound to local canonical headers

The existing 21 signed wallet-lifecycle transactions were submitted unchanged to a fresh local Geth chain. The captured chain contains genesis plus 21 blocks. Every header hash was recomputed and all 21 parent links checked. Sequential Geth t8n replay using each actual block context matches all 21 state, transaction and receipt roots, gas usage, receipt statuses, logs and signed transaction bodies. The complete starting allocation reconstructs the genesis state root.

At the final header, the strict account/storage proof reader verifies 16 registry fields against its state root. These cover four account owners, four ownership epochs, four token approvals, two NFT balances and two selected operator flags. Account 2 ends with the new owner and epoch 2; its cleared approval is proven absent. Expected slots come from the existing registry layout; epoch 2 and absent operator flags are selected for this wallet fixture, not copied as outcomes from the older registry run.

Five mutations reject: altered header root, altered header hash, wrong storage value, missing storage proof and altered account-proof node. The published reader pins the captured terminal hash explicitly rather than accepting the input header as its own anchor.

## Recheck the final registry proof

From the research branch with the existing reference readers:

```text
node integration/core-baseline-v1/verify-wallet-header-proof.mjs evidence/wallet-headers-20261112/evidence.json evidence/wallet-headers-20261112/expected-storage.json
```

The package preserves the starting allocation, complete local block/transaction/receipt capture, terminal proof, expected slots and verification reports with SHA-256 provenance. It contains disposable synthetic transactions, not real funds or private wallet keys. Prior history reconstruction and two-engine evidence are in CONTRACT_WALLET_VERIFICATION.md.

## What this does not prove

Canonical here means the captured local Geth chain, not a public-chain consensus anchor. Header hashing and trie proofs establish consistency with that selected local header; chain authentication and finality remain false. Geth node and Geth t8n share an implementation. The earlier EthereumJS comparison used repeated synthetic contexts and does not independently validate these new canonical contexts.

This proof covers selected registry state only: custody liabilities, ERC20 balances, wallet runtime/controller binding and all intermediate storage states are not yet separately proven against these headers. Their previous model/replay agreement is not a substitute for those proofs. No production wallet standard, registration decision, economic-policy agreement or release-readiness gate is closed. Independent operator reproduction remains pending. The full local capture/replay harness is retained in the private workflow; the public command above reproduces final registry proof verification, not the entire acquisition/replay process.

Next: bind custody accounting and wallet runtime/controller selection to the same final root, then replay the actual block contexts with the second execution engine. Preserve failure evidence and verification strictness.
