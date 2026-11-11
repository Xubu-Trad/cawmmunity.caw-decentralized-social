# Independent peer-recovery reproduction guide

This guide invites reproduction, not endorsement. Run from a fresh checkout pinned to the exact research commit you report. Do not assume a moving branch matches reviewed evidence. These tests use a synthetic local chain, not real funds or a public deployment.

## Setup and smallest useful contribution

Use Linux, Python 3, Geth 1.17.10, Reth 2.10.1 and Node for the existing proof reader. Require at least 2 GiB free disk and 1 GiB available memory; do not weaken the guards. Obtain clients independently and record version, executable SHA-256 and provenance. Runtime/release-signature limits are described in INDEPENDENT_CLIENT_IMPORT.md. The scripts neither install clients nor authenticate your executable downloads.

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
| run-replacement-peer.py | Head 14 retained with no peers; different source completes 28 |
| run-transfer-fault.py | Encrypted stream cuts on original/replacement; intact retry |
| run-third-peer.py | Both faulted sources stay stopped; distinct third source recovers |

## Third-peer experiment

Three source databases are separately initialized from the same hash-checked synthetic genesis/RLP fixture. Their peer identities must differ. The third source is briefly started to obtain its identity and then stopped before receiver acquisition; no third-source data reaches the receiver at that stage. Fresh Reth explicitly allows all three identities, with outbound dialing and discovery disabled.

Original and first replacement connections are truncated by the local fault proxy as in PEER_TRANSFER_FAULTS.md. Each is stopped afterward. The receiver retains an absent target and SYNCING status through both faults. The third source then starts and explicitly dials the same receiver process. No receiving-client restart, block-file import or execution-payload injection occurs. Original and first replacement remain stopped. All 29 headers match and a newly acquired proof passes 16 fields plus five negative controls. All processes stop on completion/failure.

The recorded run used encrypted cuts of 431 bytes and 24 bytes. Exact chunk boundaries and timings can vary. The proxy does not decode messages: it cannot attribute a cut to a particular block or guarantee the replacement's protocol phase. Source imports are setup only; destination acquisition is peer-based. The third source is pre-allowlisted by one operator on the same host. No autonomous discovery, independent chain selection or public consensus/finality is proved.

## What to return in PR #19

Report the exact checkout SHA, OS/runtime/client versions and executable digests; which driver and literal arguments you used (redact personal paths); process exit codes; whether fixture hashes passed; result.json and service.json; proof-checker output; and any failure with the original logs retained. For this driver verify three distinct identities, both earlier sources stopped, destinationRestarted=false, matchingHeaders=29 and allStopped=true. Record the actual stream-cut counts, without expecting identical TCP chunking.

Do not upload jwt.hex, database directories or unreviewed logs wholesale. Share only reviewed outputs; keep original failures rather than replacing them with a later success. Do not change assertions, widen timeouts or edit expected hashes to get a pass; report the mismatch first. If a process crashes, record whether cleanup completed. Never call an offline checker rerun an independent full-client reproduction.

Independent operator/live-peer reproduction remains pending. The existing separate-PC proof-check report concerns retained evidence only. Next engineering gates: protocol-aware fault attribution, separate-host execution, untrusted/unknown peer handling and authenticated public-chain selection.


## Public-source rerun and receiver restart

At pinned commit `1668b964689b7af42bb0b799511cd6d8298b18d7`, 14 public files (driver, fixture, proof reader and recursively referenced modules, expected storage model and guide) were downloaded and checked against their Git blob IDs. The unchanged driver and reader passed using fresh source and destination databases. No local private source files were substituted. Existing installed client binaries/runtime were reused. This is an author rerun from published materials, not independent operator reproduction or a clean toolchain build. See `evidence/public-peer-repro-20261111/`.

`run-receiver-restart.py` accepts the same arguments as `run-third-peer.py`. It changes one variable: after both earlier sources fail and stop, SIGKILL the receiver and restart it with its own existing database, command and identity. Before the third source connects, require the same peer identity, genesis head, missing target and SYNCING. Then require all 29 matching headers and run the same proof checker against the new output. The original and first replacement stay stopped. All test processes must be stopped in service.json.

The recorded run passed with 16 checked storage fields and five tampering controls. The receiving database held only genesis at the kill point: **this is not a mid-write crash-consistency or partially synchronized database recovery test**. Encrypted byte cuts remain opaque, the third source is pre-allowlisted, and the externally supplied target is not consensus-authenticated. Independent operator and separate-host verification remain pending. Preserve failures and report exact commit, client/runtime versions and digests as above.


## Partial-history restart boundary

See [PREFIX_RESTART_REVIEW.md](PREFIX_RESTART_REVIEW.md) for the retained abrupt-restart failure, orderly-shutdown control, and independently reported reproduction of the earlier tests. Earlier statements that independent operator reproduction was pending are superseded only for the reviewer’s fixed synthetic scope; separate-host verification remains pending.


## Persistence-policy follow-up

[The fixed-assertion threshold comparison](PREFIX_PERSISTENCE_REVIEW.md) supports buffered/unpersisted history as the explanation for the earlier abrupt-restart failure. The failure remains preserved; the new control is separately scoped and does not prove general crash durability.


## Default-policy rollback recovery

[The separate rollback recovery experiment](PREFIX_ROLLBACK_RECOVERY.md) reacquires the lost prefix and remaining history from a replacement peer while the original stays offline. This does not convert the durable-retention failure into a pass.


## Observed persistence boundary

[Paired pre-trigger and post-commit interruption tests](OBSERVED_PERSISTENCE_BOUNDARY.md) distinguish reported head from persisted history. Both drivers use the same documented arguments and fresh output directories. Neither claims a kill inside an active database write.


## Active persistence interruption

[Observed database-write interruption and strict recovery](ACTIVE_PERSISTENCE_INTERRUPTION.md) adds a strace-instrumented timing case. Its deliberate delay and exact verification limits are documented.


## Multiple observed write points

[Five fresh interruption runs](PERSISTENCE_WRITE_POINTS.md) include explicit header and receipt file selectors. Ordinal counts alone are not stable storage-phase identifiers.


## Combined persistence reproduction

[Header-sync interruption and one-command strict verification](PERSISTENCE_SYNC_REPRODUCTION.md) includes a reviewer receipt checklist. Independent reproduction remains pending.


## Fixed public-input replay

[Public-only input replay and exact inventory](PUBLIC_PERSISTENCE_REPLAY.md) verifies the published fixture/reader closure at a fixed commit. Existing clients were reused; independent reproduction remains pending.


## Input and tool preflight

[Preflight and focused rejection tests](PERSISTENCE_PREFLIGHT.md) check the fixed public source set and record tools before running nodes. They do not replace the strict recovery test.
