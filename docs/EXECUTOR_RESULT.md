# Result record inspection

FACT -- 28 focused checks exercise the retained successful fresh-process record and synthetic variants. The new inspector requires an independently supplied completion observation (exitCode zero, signal null) and expected input, source/executor manifest, source-file hashes and file counts. It rejects extra/missing fields, truncated/oversized JSON, duplicate keys, changed identities, incorrect flags, unknown outcomes and invalid gas encodings. Missing-evidence records must omit gas. Outputs are frozen and retain executionAuthenticated=false and productionAccepted=false.

The existing bounded JSON parser caps this record at 16 KiB. Gas is a canonical unsigned decimal string bounded to 256 bits for completed/reverted outcomes. Schema shape and identity equality are all this inspector establishes. It does not recompute execution, authenticate process completion or check gas against a transaction gas limit. The caller must obtain completion from its own supervised child, not from this record or an untrusted supplied completion claim.

A deliberate counterexample changes a well-formed gas value from 26012 to 26013 while keeping all identities. Structural inspection still returns executionAuthenticated=false. This documents the limit: a plausible forged result is not detected by metadata validation. A missing-evidence synthetic variant is also only a schema exercise, not a new live process observation.

From experiments/execution-engine, with Node 24.20.0:

```text
node --max-old-space-size=256 executor-result-check.mjs ../..
```

[Inspector](../reference/executor-result.mjs), [checks](../experiments/execution-engine/executor-result-check.mjs), [retained local result](../experiments/execution-engine/retained-process-result.json), [evidence](../evidence/EXECUTOR_RESULT_RESULTS.json). The retained record contains synthetic local evidence and hashes, no private filesystem paths. Review expected identities separately; deriving expected values from the result would invalidate the comparison.

The initial 27-case run is retained; the final 28th check explicitly records plausible-forgery limitations. Both passed unchanged resource guards. Existing 13/66/1241 suites were not rerun. This standalone inspector is not yet integrated into a supervisor or state adoption. Next connect it to an owned one-shot process with actual observed completion and independent expected selections, then test stale/replaced output rejection. No production acceptance or full state-root verification.
