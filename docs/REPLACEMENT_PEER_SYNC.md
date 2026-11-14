# Interrupted staged synchronization and replacement peer

## Reproduce

Use the prerequisites and trusted client command file from PORTABLE_PEER_SYNC.md (Linux, Python3, Geth1.17.10, Reth2.10.1;2GiB disk and1GiB available memory). From the exact research checkout:

```sh
python3 integration/peer-sync/run-replacement-peer.py \
  --geth /absolute/path/to/geth \
  --reth-command /absolute/path/to/reth-command.json \
  --fixture integration/peer-sync/fixture \
  --output /absolute/path/to/fresh-replacement-run

node --max-old-space-size=256 \
  integration/core-baseline-v1/check-geth-header-proof.mjs \
  /absolute/path/to/fresh-replacement-run/evidence.json \
  evidence/registry-later-20261109/result.json
```

## Controlled variable and observations

The driver splits the existing fixture at a complete RLP block boundary without altering block bytes. SourceA is initialized separately with blocks1–14; replacementB is initialized with all28blocks. Their node identities must differ. Both use the same complete genesis. The Reth destination starts empty, with both sources explicitly allowlisted, discovery disabled and outbound dialing disabled. Only A initially dials the destination.

The driver selects block14 and waits for execution acceptance and head14. It confirms block28 is absent, stops A and waits until destination peer count is zero. It then selects the known block28 target three times: each response must be SYNCING, the head must remain14 and block28 must remain absent. Only then does B dial the same still-running destination. No destination import, database copy or execution-payload injection is used. Original A remains stopped.

The destination subsequently returns VALID for the selected target. All29header hashes/state roots match. Its fresh eth_getProof response passes the unchanged16-field reader and five proof-tampering controls. All three test processes stop; results and logs are retained. Test results are in `evidence/replacement-peer-20261111/result.json`.

## Boundaries

This interrupts staged acquisition at a verified block boundary. It does not interrupt an in-flight packet or partially received block. The replacement is known and pre-allowlisted, not discovered automatically. Separate databases and identities do not mean separate hosts, operators or independent fixture providers. Source databases are initialized from the public RLP fixture; only destination acquisition is peer-based. The selected head is supplied by the driver and safe/finalized hashes remain zero. Release/runtime verification limits remain as documented in INDEPENDENT_CLIENT_IMPORT.md. No public consensus/finality, hostile-peer resistance or production readiness is established.

Next: controlled interruption during actual transfer, malformed/unavailable replacement controls, separate-host/operator reproduction and authenticated public-chain selection. Preserve all earlier evidence scopes rather than treating this bounded pass as completion of those gates.
