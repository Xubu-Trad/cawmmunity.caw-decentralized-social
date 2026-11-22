# Observed persistence boundary: pre-trigger and post-commit interruption

## Configuration and source basis

Two fresh runs use Reth 2.10.1, explicit persistence threshold **14**, memory-block-buffer target **0**, state-masking blocks **0**, and engine::persistence debug logging. These are experimental settings, not a proposed production default. The paired variable is the acquired prefix length: 14 versus 15. Both use the same fixture and strict proof reader.

At the version-pinned source, [tree.rs lines 2260–2279](https://github.com/paradigmxyz/reth/blob/58ebce14ae63dab040beae301e1578cd0dc55e8a/crates/engine/tree/src/tree/mod.rs#L2260) skips threshold persistence when the in-memory count is at or below the configured threshold. Above it, the persistence frontier depends on the buffer/masking settings. [persistence.rs lines 175–218](https://github.com/paradigmxyz/reth/blob/58ebce14ae63dab040beae301e1578cd0dc55e8a/crates/engine/tree/src/persistence.rs#L175) emits `Saving range of blocks` before writes and `Saved range of blocks` after `provider_rw.commit()` returns and a BAL-store flush attempt. BAL flush errors are handled separately; this marker is not a blanket guarantee of every storage subsystem or hardware durability. Installed executable revision was previously recorded; no reproducible-build attestation is claimed.

## Results

| Check | 14-block pre-trigger run | 15-block post-commit run |
|---|---|---|
| Prefix header hashes/state roots before kill | 15 matched including genesis | 16 matched including genesis |
| Persistence log before kill | No saving/saved marker | Saving and Saved markers for blocks 1–15; exact block-15 hash matched |
| SIGKILL and restart with same DB/identity, no peers | Head 0; blocks 1–14 absent | Head 15; all 16 retained headers matched |
| Target block 28 before replacement | Absent; SYNCING | Absent; SYNCING |
| Replacement peer, original remains stopped | 29 headers match | 29 headers match |
| Fresh strict storage-proof check | 16 fields; five rejection controls | 16 fields; five rejection controls |
| Cleanup | All test processes stopped | All test processes stopped |

The post-commit log records save start at 12:38:23.723653 UTC and saved at 12:38:23.784292 UTC on 2026-11-11. These are client log timestamps, not independently trusted time. The harness observes the marker before issuing SIGKILL; it does not claim an immediate kill at the commit instruction. The original peer was already stopped, and no replacement was connected before restart retention checks. The receiver imported no history files.

## What this establishes

FACT: with these explicit settings, head visibility before the configured persistence trigger did not imply restart retention. After observing the matching saved marker, this run retained the prefix across process termination. Both cases then recovered complete verified fixture history over a replacement connection.

INFERENCE: this reinforces the buffering explanation of the earlier default-policy block-14 regression. It is not proof of universal durability, and the original default-policy retention failure is not relabeled a pass.

## Reproduction and boundaries

Run `integration/peer-sync/run-observed-before.py` and `run-observed-after.py` separately with the same arguments in INDEPENDENT_PEER_REPRODUCTION.md and fresh output directories. Both retain fixture digests, 2 GiB free-disk and 1 GiB available-memory guards, 30-second readiness polling, original peer isolation, restart identity checks, and exact header/root comparisons. After each driver run, use the existing check-geth-header-proof.mjs on its newly acquired evidence.json and the expected registry model.

Results and marker text are in evidence/observed-persistence-20261111/{before,after}.json. Scripts enforce marker absence before and the exact saved prefix hash after; changed observations fail instead of being silently normalized. Prior failed lanes remain intact.

No mid-write interruption, kernel/filesystem/power-loss test, repeated timing study, separate-host reproduction, public consensus/finality, autonomous discovery or independent review of this new pair is claimed. The source comment alone is not proof of storage durability. Next: controlled interruption while a write is in flight, with direct evidence of timing, followed by the same strict recovery checks; independent reproduction remains requested.
