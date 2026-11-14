# Interruption during an active persistence operation

FACT — a fresh, instrumented Reth 2.10.1 run observed the exact block-15 `Saving range of blocks` marker, then a 4,096-byte `pwrite64` to the destination MDBX database at offset 16,384. The watcher stopped the process group, found no matching `Saved range of blocks` marker, and killed the group. This is an interruption during the persistence operation, **not proof of interruption inside a kernel write**. The trace reports the write returning 4,096 bytes.

## Timing and configuration

The run uses persistence threshold 14, memory buffer 0 and state masking 0. `strace` delays pwrite64 syscall exit by 100 ms to expose the window. This instrumentation affects timing; it is not an ordinary uninstrumented crash. Save start: 2026-11-11 12:42:05.392176 UTC; observed write trace timestamp: 1794400925.416554. These are local timestamps, not trusted external time. Block 15 was the requested persistence target, not an independently observed pre-kill RPC head.

At pinned Reth source [persistence.rs](https://github.com/paradigmxyz/reth/blob/58ebce14ae63dab040beae301e1578cd0dc55e8a/crates/engine/tree/src/persistence.rs#L175), the start marker precedes persistence and the saved marker follows provider commit and a BAL flush attempt. Absence of that log marker is not alone proof that no subsystem committed.

## Restart and strict recovery

- Restart of the same database preserved node identity and returned to genesis with zero peers. The retained genesis hash and state root matched. Target block 28 was absent and fork choice returned SYNCING.
- The original source was stopped. A replacement Geth peer with a different identity restored all 29 fixture headers, including exact hashes and state roots. The receiver imported no history file.
- The unchanged strict proof reader verified 16 storage fields against the recovered header. All five rejection controls remained effective: header root, header hash, wrong value, missing proof and altered node.
- All test services stopped; a separate process-list check found no surviving test node.

INFERENCE — this run recovered a consistent older state after interruption in the observed save window, then recovered the complete fixture from a replacement peer. It does not establish universal atomicity or durability.

## Reproduce and inspect

Use `integration/peer-sync/run-active-persistence.py` with the existing geth, reth-command, fixture and fresh output arguments in [the reproduction guide](INDEPENDENT_PEER_REPRODUCTION.md). Linux strace with delay injection support is required. Run the existing `check-geth-header-proof.mjs` against the newly produced evidence.json and expected registry model afterward. The driver requires a destination-file write after the matching start marker and rejects a matching completion marker before the kill. Resource guards and strict header/proof comparisons are unchanged.

The published driver is the exact executed script; its historical `interruptedAtBlock` result field denotes the requested persistence target, not an observed head. The reviewed summary renames this field and records that distinction explicitly. Only the personal directory prefix in the trace line is redacted; raw evidence remains preserved. No JWT or private run files are published.

UNRESOLVED — this is one same-host synthetic run with explicit experimental settings and deliberate syscall delay. Independent reproduction, repeated interruption positions, separate-host testing, filesystem/power failure, public consensus/finality and production readiness remain unproven. Previously failed lanes remain unchanged. Next: independently replay this experiment and expand interruption coverage without changing verification rules.
