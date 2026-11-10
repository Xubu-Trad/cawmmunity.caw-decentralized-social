# Registry deployment and account-code proof composition

FACT — the selected registry's deployment transaction, successful receipt and account code are now checked under the same selected synthetic header. Existing transaction, receipt, sender and header-bound state-proof readers are reused without weakening their rules.

The test reconstructs the complete state trie from the retained Geth allocation immediately after the registry deployment (transaction1 of the28-operation fixture). Storage tries omit zero entries; account values include nonce, balance, storage root and code hash. The reconstructed state root must equal Geth's retained result. The registry's runtime hash must match the explicitly selected manifest.

An account proof is generated for that registry and composed with the deployment transaction/receipt commitments. This is stronger than comparing a code string alone: the proof ties the account's code hash to the state root committed by the selected header. It does not independently establish the header's authenticity or the correctness of execution.

## Result and controls

The selected synthetic header is `0xb3dbaa5ffc6b59626a68b5853949ed92cde3c2d036b48bafafb7845abe05b717`. Account code proof verification passes for registry `0x19A827174F66B3c66ad7063951D7b4F94f996e77` and deployment transaction `0x07afc316a9616a5a2dbc695400cacf44ad6f177d29e97dd084ab0938e97cef7f`.

Ten mutations reject: wrong header selection, changed transaction, missing transaction, changed receipt status, changed logs, wrong receipt index, changed runtime, wrong account, wrong code hash and missing account proof. Chain authentication, consensus and finality flags remain false.

## Reproduce

First run the [explicit registry selection check](REGISTRY_SELECTION_RESEARCH.md), which checks the manifest's compilation and constructor bindings. Then:

```sh
node --max-old-space-size=256 integration/core-baseline-v1/check-registry-codeproof.mjs evidence/registry-selection-20261109/manifest.json 33673024dbf0d57084e36cd62e8b9518f3fc6c346cf1807a71ba8b07e690a56a evidence/registry-codeproof-20261109/evidence.json 0xb3dbaa5ffc6b59626a68b5853949ed92cde3c2d036b48bafafb7845abe05b717
```

Uses Node20.20.2, ethers6.16.0 and the existing reference modules, including the bounded JSON parser. Inputs and generated evidence are hash-recorded. The separate local construction script uses the retained Geth allocation; it is not another live-chain acquisition.

## Remaining trust boundary

This is a newly assembled synthetic London header, not a mined block. It combines retained deployment observations with the reproduced Geth post-state root. A caller selecting its hash does not supply an independently trusted chain anchor. The account proof uses an empty storage-key list: it commits to the account storage root but does not authenticate individual owners, epochs, approvals, balances or initialization slots.

Next: bind relevant registry initialization/ownership slots to the same root using the compiler layout and independently reconstructed expected values. Keep public-chain checkpoint/finality selection separate and unresolved. No production registry approval, real-token compatibility or adopted protocol policy follows from these tests. README updates remain paused.


## Initialization follow-up

[Sixteen selected initialization slots](REGISTRY_INITIALIZATION_PROOF.md) now verify under the same root. This extends the account-only fixture without changing its original scope; later state and public-chain anchoring remain open.
