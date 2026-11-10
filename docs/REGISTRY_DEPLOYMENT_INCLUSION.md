# Registry deployment inclusion binding

The selected registry deployment is now connected to the existing transaction-trie, receipt-trie and independent sender readers. This closes a local evidence-composition step; it does **not** establish an authenticated public-chain deployment.

## Verified boundary

The adapter requires an explicitly selected manifest digest and header hash. It verifies the complete transaction and receipt commitments under that header, associates the selected deployment hash with the receipt at the same index, checks success, independently recovers the signer, and derives the CREATE address from signer and nonce. The separate selection checker remains responsible for compiled initialization/runtime expectation and the manifest's deployment selection.

The test fixture assembles a **synthetic London header** around the first two retained local signed transactions and their recorded receipts. It is a commitment test, not a newly mined block or an assertion that this header belongs to Ethereum or any other network. It does not use an RPC contractAddress label as proof. Six mutations reject: wrong selected header, changed signed transaction, missing transaction, changed status, changed logs and wrong receipt index.

Result: selected registry `0x19A827174F66B3c66ad7063951D7b4F94f996e77`, deployment index1, transaction `0x07afc316a9616a5a2dbc695400cacf44ad6f177d29e97dd084ab0938e97cef7f`. The selected synthetic header is `0xc273e2d510d9f1c5406dd22d5f0597d01bc8b81c4fb563725f091d5117d3f8a7`.

## Reproduce

First run the [manifest/initialization selection checker](REGISTRY_SELECTION_RESEARCH.md) with its pinned compiler input and operations. Then use the same manifest:

```sh
node --max-old-space-size=256 integration/core-baseline-v1/check-registry-inclusion.mjs evidence/registry-selection-20261109/manifest.json 33673024dbf0d57084e36cd62e8b9518f3fc6c346cf1807a71ba8b07e690a56a evidence/registry-inclusion-20261109/evidence.json 0xc273e2d510d9f1c5406dd22d5f0597d01bc8b81c4fb563725f091d5117d3f8a7
```

Uses the existing reference readers and ethers6.16.0 under Node20.20.2. Chain ID is converted from manifest decimal to the sender reader's canonical hexadecimal format. CREATE is represented as `0x` by that reader. Earlier failed adapter runs are preserved; verification rules were not weakened.

## Still required for authenticated deployment

1. An independently trusted chain checkpoint/header selection and applicable finality evidence. Merely accepting a hash from the same source as its proof is not authentication.
2. A contract-account proof under the selected authenticated state root, matching its code hash to the selected deployed runtime. The current fixture supplies no account-code proof.
3. Initialization and subsequent ownership-state reconstruction under that chain, including any relevant storage proofs and dependency/authority review.

Output explicitly keeps chainAuthenticated, accountCodeProofVerified, consensusVerified and finalityVerified false. Receipt inclusion under a header does not itself prove valid execution or registry policy. No mainnet/testnet deployment, release approval or real-token compatibility is claimed. Next work is account-code proof composition and trusted-anchor selection; the public-chain requirement remains open. README updates stay paused.
