# Registry initialization storage proof

FACT —16 selected initialization slots now verify under the same selected header as the registry deployment and runtime code. The compiler input is SHA-256 pinned by the selected manifest. solc0.8.30 provides the storage layout; the runtime hash must also match the selected registry. Expected values come from constructor-owner assignments and this fixture's explicit zero-initialization rules, not from the claimed proof values.

| Selected fields | Count | Verified initial values |
| --- | --- | --- |
| Owners of accounts1–4 |4| Constructor payer for all four |
| Epochs of accounts1–4 |4| Zero |
| Single-token approvals for accounts1–4 |4| Zero address |
| Payer and test outsider NFT balances |2|4 and0 |
| Payer-to-outsider and outsider-to-payer operator permissions |2| False |

Mapping keys are derived from compiler slots using ABI-encoded keys and Keccak; nested operator mappings use both levels. Proofs are constructed from the retained Geth allocation immediately after registry deployment. The complete reconstructed state root equals the retained Geth root. The existing strict proof reader verifies both nonzero entries and absence proofs for zero entries. No included-zero workaround or weakened proof acceptance is used.

The expectation helper deliberately supports this selected constructor-only fixture. The account4 assignment and two operator probes are explicit research choices. Verifying these16 slots does not quantify over every possible mapping key or establish later ownership.

## Reproduce

Run the existing manifest selection check first. With pinned Node20.20.2, ethers6.16.0 and solc0.8.30:

```sh
node --max-old-space-size=256 integration/core-baseline-v1/check-registry-storage.mjs evidence/registry-selection-20261109/manifest.json 33673024dbf0d57084e36cd62e8b9518f3fc6c346cf1807a71ba8b07e690a56a evidence/registry-storage-20261109/evidence.json 0xb3dbaa5ffc6b59626a68b5853949ed92cde3c2d036b48bafafb7845abe05b717 evidence/registry-withdrawal-verification-20261109/input/compiler-input.json
```

The helper compiles only to derive the layout and runtime expectation; this is not a new chain execution. The selected header is synthetic and contains the retained Geth post-deployment root.

## Negative cases and limits

All14 mutation controls reject. Ten retained controls cover deployment/header/code binding. Four new controls alter an owner value, omit a storage entry, duplicate an entry, or corrupt a storage proof node. Proof entry completeness and expected values are checked independently of the supplied slot values.

This verifies initialization under a selected root, not public-chain authenticity, finality, full contract correctness or release approval. The local manifest and synthetic header remain explicit trust inputs. Next: compare later registry-state proofs against independently reconstructed transfer/approval history. Real-chain anchoring and production protocol decisions stay open. README updates remain paused.
