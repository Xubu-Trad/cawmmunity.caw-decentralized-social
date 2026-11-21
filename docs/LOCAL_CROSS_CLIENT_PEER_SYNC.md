# Local Geth-to-Reth peer synchronization

**Local cross-client peer synchronization:** A fresh Reth database acquired the 28-block fixture from Geth over a localhost peer connection, starting at genesis without block-file import. All 29 headers match. After both processes stopped, restarting only Reth with zero peers preserved all headers and independently generated registry proofs for16fields that pass the unchanged strict reader. Geth initiated the successful connection; three outbound/automatic Reth attempts timed out and remain recorded. This verifies bounded local peer acquisition and source-offline readback, not separate-host resilience, public-chain authentication or consensus finality. The target hash was operator-selected.

## Experiment boundary

The source is a copy of the retained Geth fixture database. The destination is a new Reth2.10.1 database initialized only from the same complete genesis. Before synchronization its block number is0 and block28 is absent. No block file, source database or execution payload is supplied to the destination.

Both clients use chain31337/Shanghai. Discovery is disabled. Geth restricts peers to127.0.0.0/8; Reth uses trusted-only with the source node identity. HTTP and Engine endpoints are loopback-only. The successful test permits one Reth inbound slot and calls Geth admin_addPeer with the destination's loopback enode. The observed destination peer count is1.

The test driver submits engine_forkchoiceUpdatedV2 with the previously recorded target hash; safe and finalized hashes remain zero. Responses move from SYNCING to VALID. That VALID response concerns execution of the selected history; it is not a proof that any public consensus selected or finalized that history. Headers and bodies are acquired from the peer, not sent as Engine execution payloads.

## Results and controls

- All29 acquired header hashes and state roots match the retained Geth chain.
- Destination begins at block0 with no block28 and uses no file import.
- Both processes stop. Destination-only restart with no peers returns all29headers.
- Reth eth_getProof after restart verifies16selected registry fields against the final header with the unchanged strict reader; the cleared approval is absent.
- Five existing proof/header tampering controls reject altered root/hash/value, omitted proof and altered node.
- Earlier automatic/trusted-peer, diagnostic, and explicit Reth-dial attempts timed out with no peer. Reverse dialing from Geth succeeded. The outbound-dial cause is unresolved; no general network interoperability claim is made.

The public result and actual post-restart proof are under `evidence/registry-p2p-sync-20261110/`. Check the latter using:

```sh
node --max-old-space-size=256 integration/core-baseline-v1/check-geth-header-proof.mjs evidence/registry-p2p-sync-20261110/evidence.json evidence/registry-later-20261109/result.json
```

Full acquisition logs and failed attempts remain preserved in the local evidence lanes. A portable automated two-client driver has now been run; see PORTABLE_PEER_SYNC.md for commands and exact limits. Client/runtime digest checks and unverified release signatures retain the supply-chain limits documented in INDEPENDENT_CLIENT_IMPORT.md.

## Next gates

Explain outbound-dial behavior; repeat with separate operators/hosts; test interrupted acquisition and malicious/unavailable peers; select and validate a public checkpoint through actual consensus/finality evidence. Same-host localhost success does not establish internet availability or public-chain authenticity. Source-offline restart proves retained data remain usable, not indefinite storage durability.
