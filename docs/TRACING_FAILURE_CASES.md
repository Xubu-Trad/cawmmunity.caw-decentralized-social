# Missing tracing tool and timeout rejection

The existing early tracing gate was tested without modifying its ten-second timeout, tracing configuration, resource guards or recovery verifier.

| Case | Observation |
|---|---|
| No strace on controlled PATH | TRACE_PROBE_START_FAILED with FileNotFoundError; stopped before genesis or source-data creation |
| Controlled tracer that starts a sleeping child and hangs | TRACE_PROBE_TIMEOUT after approximately10.4 seconds; both recorded process IDs absent after cleanup |

Both driver invocations exited nonzero with TRACING_CAPABILITY_BLOCKED, preserved diagnostics, and never invoked the invalid Geth sentinel. These are controlled harness tests, not a newly observed kernel tracing denial. No Geth/Reth test nodes started. The timeout process and descendant shared a process group, exercising the existing group-kill cleanup. The regression permits an exited zombie as non-running, but this actual run observed both IDs absent. Escaped process groups and hostile tools are outside this test.

## Repeat

```sh
python3 integration/peer-sync/test-tracing-failures.py --driver integration/peer-sync/run-header-sync-early-trace.py --fixture integration/peer-sync/fixture --reth-command "$RETH_COMMAND_JSON" --output "$FRESH_OUTPUT"
```

Python and the supplied driver are invoked through absolute paths. PATH is modified only in child test environments; the caller's environment is untouched. The controlled timeout executable starts a local sleeping child. A25-second outer test limit bounds the expected10-second gate. Use a fresh output directory. Existing fixture/resource guards still run before the probe; insufficient resources are not a successful negative test.

The supported path's previously published29-header recovery and16-field/five-control proof result is unchanged and was not rerun here. The new cases demonstrate early failure handling, not additional persistence durability or independent recovery. ahdmesh's independent R-04 remains environment-blocked.

## Merge review

PR #20 at9238bb7eaef018fa13e9d1f35633a5a03efe82d6 already had approval for its bounded correction. Its three-file evidence/test change was checked on the proposed merge;24 model and13 paid-action tests passed. Two initial local test-input acquisition failures are retained; missing files were fetched at the same pinned merge commit, without changing tests. PR #20 merged as5b42317938d9d9b89d2e7dea4769f7071559c33f. No full-suite or fresh EVM result is claimed. C-004 remains unresolved.

PR #19 remains draft. PR #16's specific comparator correction is verified but its overall review still needs reconciliation; it was not merged on a scoped pass alone. Other open research PRs were not treated as accepted merely because GitHub can merge them.
