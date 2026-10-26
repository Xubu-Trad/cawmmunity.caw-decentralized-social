# Structured local replay outcomes

FACT —59 grouped checks passed:51 prior adapter groups and eight outcome groups. The new wrapper summarizes one trusted engine invocation and always discards the attempt afterward. It checks adapter health before and after execution; a swallowed witness error followed by a fabricated success-shaped result remains an unclassified failure.

| Kind | Meaning in this experiment |
| --- | --- |
| execution-completed | Healthy adapter, no engine exception, receipt status1 |
| execution-reverted | Healthy adapter, engine reports revert, receipt status0 |
| missing-evidence | Exact missing-account or missing-slot error code |
| unsupported-operation | Exact adapter unsupported-operation code |
| local-resource-limit | Exact adapter resource-limit code; not consensus invalidity |
| unclassified-failure | Unknown error, invalid result shape or unhealthy attempt |

Completed/reverted results include gasUsed as decimal text. Rejected outcomes omit it. Every frozen, JSON-serializable report keeps stateComparisonVerified, stateRootRecomputed, publicChainAuthenticated and productionAccepted false. Raw exception messages/stacks are omitted. Stable local codes now identify adapter resource and unsupported-operation failures; messages are not parsed.

Tests execute acquired successful and reverting contract fixtures (26012 and26018 gas), plus missing-slot rejection, actual callback-budget exhaustion, unsupported operation, unknown error, malformed result and swallowed failure. Each attempt is unusable after return. Prior acquired state/receipt comparisons still run separately; the wrapper does not perform them or authenticate supplied results. It trusts its engine callback and is not a verifier for reports received from third parties. Other EVM exceptions remain unclassified pending evidence-backed handling.

From `experiments/execution-engine`, after frozen installation:

```text
node --max-old-space-size=256 replay-outcome-check.mjs ../..
```

[Implementation](../experiments/execution-engine/replay-outcome.mjs), [checks](../experiments/execution-engine/replay-outcome-check.mjs), [result hashes](../evidence/REPLAY_OUTCOME_RESULTS.json). Prior51 checks are included, not51 new cases. Ordinary1241-test suite unchanged and not rerun; dependency/resource guards unchanged.

UNRESOLVED — report provenance, binding a report to exact input/engine identity, strict external report validation, full post-state roots, arbitrary execution/fork coverage and public-chain authority. Next bind reports to their input and pinned engine evidence without converting a local summary into an acceptance certificate. Production release remains blocked.
