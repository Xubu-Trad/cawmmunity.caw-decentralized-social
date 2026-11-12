# Early tracing capability gate

The new `run-header-sync-early-trace.py` adds a bounded probe after existing resource/input checks but **before genesis copying, Geth initialization or either test-node startup**. The prior run-header-sync.py and its pinned historical snapshot remain intact.

The probe launches only a small Python child under the same strace syscall family and pwrite64 exit-delay setting as the experiment. The child performs a 15-byte pwrite and fsync. Acceptance requires exit0, an observed delayed pwrite result, a sync trace and exact file bytes. A missing tracer, permission denial, timeout or incomplete trace fails closed with TRACING_CAPABILITY_BLOCKED. Diagnostics and hashes remain in the fresh output directory. No privilege or environment restriction is changed.

## Tested results

| Case | Result |
|---|---|
| Simulated tracer denial | Rejected before genesis/source-data creation; no Geth invocation |
| Tracer exits0 without trace evidence | Rejected at the same early gate |
| Real tracing on this host | Probe passed, then full recovery completed |

The negative cases substitute controlled test executables through PATH; they test driver behavior, not an actual kernel-denial reproduction. They use an invalid Geth path as an additional sentinel and require the tracing-specific error. The real run uses the installed strace. It restarts at genesis, recovers29 exact header hashes/state roots from a replacement peer, and passes the unchanged strict reader's16 fields/five rejection controls. All test services stopped.

## Reproduce

Use the existing combined command in [PERSISTENCE_SYNC_REPRODUCTION.md](PERSISTENCE_SYNC_REPRODUCTION.md), changing only `--driver` to `integration/peer-sync/run-header-sync-early-trace.py`. Keep `tracing-capability.py` beside that driver. Use a fresh output path and retain the same fixture, reader, expected model, trusted client command and resource guards.

These two new files belong to this review revision, not the older14-file execution snapshot. The old pinned-input preflight still verifies that older set; it does not authenticate this new driver/helper. Review their hashes in the accompanying provenance and pin this revision when reproducing the new gate. Do not silently change the old manifest to include them.

On a blocked probe, inspect trace-capability.json and trace-probe.stderr. Preserve the failed directory; select an authorized compatible environment rather than bypassing restrictions or labeling an untraced run equivalent. A Python-child probe pass does not guarantee Reth tracing will work, nor does it override later readiness, timing, proof or cleanup failures. The timeout kills the probe's process group and saves diagnostics; the timeout path was implemented but not exercised in this focused test set.

## Independent review boundary

ahdmesh's R-04 remains environment-blocked before recovery. This change addresses the late detection observed in that report; it does not convert the independent attempt into a pass. The new supported run is local and instrumented. Public-chain finality, power-loss safety, independent execution and production readiness remain unresolved. Signature and runtime provenance checks remain separate evidence.
