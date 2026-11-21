# Reproduce local two-client peer synchronization

This is an executable reproduction package for the local synthetic chain, not a public network deployment. It removes the earlier dependency on the original operator's source database and private filesystem paths.

## Requirements

Linux, Python3 standard library, Geth1.17.10 and Reth2.10.1 on a compatible runtime; at least2GiB free disk and1GiB available memory. For the proof check, use Node and the existing repository reader. See INDEPENDENT_CLIENT_IMPORT.md for release/runtime verification limits. This driver does not download or authenticate client binaries. Review and independently obtain the pinned clients; do not execute a command-array file from an untrusted source.

From a checkout of this exact PR revision, create a JSON file containing your trusted Reth command, e.g. `["/absolute/path/to/reth"]`. An isolated runtime-loader command array is also supported. Choose a fresh output directory whose parent already exists:

```sh
python3 integration/peer-sync/run-peer-sync.py \
  --geth /absolute/path/to/geth \
  --reth-command /absolute/path/to/reth-command.json \
  --fixture integration/peer-sync/fixture \
  --output /absolute/path/to/fresh-peer-run

node --max-old-space-size=256 \
  integration/core-baseline-v1/check-geth-header-proof.mjs \
  /absolute/path/to/fresh-peer-run/evidence.json \
  evidence/registry-later-20261109/result.json
```

## What the driver does

Checks every listed fixture digest before creating its output. Initializes Geth from the complete synthetic genesis and imports the published RLP blocks into this SOURCE only. The Reth destination starts empty with that genesis; no source database, block file or Engine execution payload is supplied to it. The driver verifies genesis-only initial state, allows the known source peer, disables discovery, requests the externally selected head through Engine forkchoice, and compares all29header hashes and state roots. It obtains an actual destination eth_getProof response for the selected registry slots. Both clients stop in finally; logs and a service receipt are retained.

The source-file import is intentional fixture setup, not evidence of source-side network acquisition. All RPC and Engine endpoints are loopback-only. Reth's peer listener is loopback; Geth restricts peers to loopback. JWT secrets are generated locally, stored mode0600 and excluded from provenance/publication. Do not publish the output directory wholesale.

## Verified result

The first package run matched all29headers, with SYNCING then VALID, and the unchanged strict reader matched16fields plus all five existing mutation rejections. A one-byte whitespace change to the fixture genesis caused a digest rejection before output-directory creation or client startup. The fixture manifest is a trusted repository input, not an independent signature or proof of chain authenticity.

Results: `evidence/portable-peer-20261111/result.json`. An independent operator has not yet run this package. This remains same-host localhost execution with an externally selected target hash and zero safe/finalized hashes. It does not verify public consensus, indefinite storage availability, alternate-provider failover or interrupted partial download. Earlier outage and restart experiments are separate scoped results; this driver does not silently claim to repeat them.

Next: independent operator reproduction, then interruption/replacement-source controls and separate-host execution, followed by authenticated public-chain selection.


## Follow-up: replacement peer

See REPLACEMENT_PEER_SYNC.md for the separate staged block14 outage/replacement experiment and runnable driver. It does not change the original run scope above.


## Follow-up: transport truncation

See PEER_TRANSFER_FAULTS.md for original/replacement encrypted-stream cuts and intact retry, including the preserved V1 timing failure.


## Reviewer entry point

See INDEPENDENT_PEER_REPRODUCTION.md for the smallest useful run, third-peer recovery, required evidence and reporting boundaries.
