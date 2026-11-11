# Independent peer-recovery reproduction guide

This guide invites reproduction, not endorsement. Run from a fresh checkout pinned to the exact research commit you report. Do not assume a moving branch matches reviewed evidence. These tests use a synthetic local chain, not real funds or a public deployment.

## Setup and smallest useful contribution

Use Linux, Python3, Geth1.17.10, Reth2.10.1 and Node for the existing proof reader. Require at least2GiB free disk and1GiB available memory; do not weaken the guards. Obtain clients independently and record version, executable SHA-256 and provenance. Runtime/release-signature limits are described in INDEPENDENT_CLIENT_IMPORT.md. The scripts neither install clients nor authenticate your executable downloads.

Create your own trusted JSON command array, e.g. `["/absolute/path/to/reth"]`. Do not execute someone else's command-array file without inspection. Run each driver with the same arguments below but a different, nonexistent output directory:

```sh
python3 integration/peer-sync/run-third-peer.py \
  --geth /absolute/path/to/geth \
  --reth-command /absolute/path/to/reth-command.json \
  --fixture integration/peer-sync/fixture \
  --output /absolute/path/to/fresh-third-peer-run

node --max-old-space-size=256 \
  integration/core-baseline-v1/check-geth-header-proof.mjs \
  /absolute/path/to/fresh-third-peer-run/evidence.json \
  evidence/registry-later-20261109/result.json
```

For a smaller first contribution, run `run-peer-sync.py` with those arguments. A reviewer may run only the proof checker against retained evidence, but must label that separately from launching clients and acquiring fresh proofs.

| Driver | Additional behavior to check |
| --- | --- |
| run-peer-sync.py | Fresh source fixture import; fresh destination peer acquisition |
| run-replacement-peer.py | Head14 retained with no peers; different source completes28 |
| run-transfer-fault.py | Encrypted stream cuts on original/replacement; intact retry |
| run-third-peer.py | Both faulted sources stay stopped; distinct third source recovers |

## Third-peer experiment

Three source databases are separately initialized from the same hash-checked synthetic genesis/RLP fixture. Their peer identities must differ. The third source is briefly started to obtain its identity and then stopped before receiver acquisition; no third-source data reaches the receiver at that stage. Fresh Reth explicitly allows all three identities, with outbound dialing and discovery disabled.

Original and first replacement connections are truncated by the local fault proxy as in PEER_TRANSFER_FAULTS.md. Each is stopped afterward. The receiver retains an absent target and SYNCING status through both faults. The third source then starts and explicitly dials the same receiver process. No receiving-client restart, block-file import or execution-payload injection occurs. Original and first replacement remain stopped. All29headers match and a newly acquired proof passes16fields plus five negative controls. All processes stop on completion/failure.

The recorded run used encrypted cuts of431bytes and24bytes. Exact chunk boundaries and timings can vary. The proxy does not decode messages: it cannot attribute a cut to a particular block or guarantee the replacement's protocol phase. Source imports are setup only; destination acquisition is peer-based. The third source is pre-allowlisted by one operator on the same host. No autonomous discovery, independent chain selection or public consensus/finality is proved.

## What to return in PR19

Report the exact checkout SHA, OS/runtime/client versions and executable digests; which driver and literal arguments you used (redact personal paths); process exit codes; whether fixture hashes passed; result.json and service.json; proof-checker output; and any failure with the original logs retained. For this driver verify three distinct identities, both earlier sources stopped, destinationRestarted=false, matchingHeaders=29 and allStopped=true. Record the actual stream-cut counts, without expecting identical TCP chunking.

Do not upload jwt.hex, database directories or unreviewed logs wholesale. Share only reviewed outputs; keep original failures rather than replacing them with a later success. Do not change assertions, widen timeouts or edit expected hashes to get a pass; report the mismatch first. If a process crashes, record whether cleanup completed. Never call an offline checker rerun an independent full-client reproduction.

Independent operator/live-peer reproduction remains pending. The existing separate-PC proof-check report concerns retained evidence only. Next engineering gates: protocol-aware fault attribution, separate-host execution, untrusted/unknown peer handling and authenticated public-chain selection.
