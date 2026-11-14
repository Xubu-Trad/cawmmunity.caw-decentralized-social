# Registry proofs bound to local client headers

**Header-bound storage and second-engine progress:** All 16 selected registry fields verify against the actual final local Geth header using the unchanged strict reader; the cleared approval verifies as absent. Five tampering controls reject changed header roots/hashes, values, missing proofs and altered nodes. A separate EthereumJS 10.1.3 replay from the complete starting allocation reproduces all 28 Geth state roots, gas charges, outcomes and logs from the same signed transactions. This is independent execution-engine agreement, not a second full client's synchronization/consensus test. Public-chain authentication and finality remain unproven.

The selected header is `0xb9fe1c52df006a50dae9230ef0ea8c55be471f05f910899032abfed6d1dee763`, with state root `0x0e5c8a09a836801852924770722afd33969ed8d0f323a4011ac2a9b30d578552`. Proofs are generated from the complete replay allocation and accepted only under the captured header hash and its committed root. The expected sixteen values come from the previously reconstructed ownership/approval model. These are replay-generated proofs, not a new RPC eth_getProof capture.

Run the strict composition from the draft checkout:

```sh
node --max-old-space-size=256 integration/core-baseline-v1/check-geth-header-proof.mjs evidence/registry-geth-bound-20261110/evidence.json evidence/registry-later-20261109/result.json
```

The EthereumJS runner takes capture JSON, complete genesis JSON and an output path. It requires the retained pinned EthereumJS10.1.3 dependency set; the full capture/genesis portability package is still pending. It executes signed transactions in captured block environments and checks every post-transaction root. It does not implement a second consensus client, establish chain membership or finalize these local blocks. Existing oversized-transaction reader limits are unchanged. Next package the complete reproducible inputs, add second-engine rejection controls, and test a fully independent client/checkpoint source.
