# Shared bounded witness adapter

FACT — the six acquired replay harnesses now also run through one shared adapter. Original experiment sources remain intact as historical evidence.34 grouped cases passed:26 repeated groups across transfer, missing account, contract increment, execution revert, storage clear and capped refund, plus eight unsupported-method rejection groups. These overlap earlier cases; they are not34 new independent scenarios.

The shared implementation reads only selected proven accounts/code/storage and journals supported nonce/balance/storage changes. It rejects code replacement, account deletion, storage clearing through the bulk API, state-root get/set/query, shallow copying and balance-access-list ingestion. Each of these eight tested unsupported calls permanently invalidates the attempt, even after rollback. Subsequent storage reads/writes and checkpoints reject.

A stronger check reproduced a consolidation defect: unsupported calls marked adapter failure, but getStorage did not consult that marker. The initial health-only checks missed this. The failed source and run are preserved privately. The shared implementation now checks health before storage access, original-storage cache reads, checkpoint and commit; cleanup revert remains available. The stronger tests and all acquired replay comparisons pass. No rejection was relaxed.

After the existing frozen installation, run from `experiments/execution-engine`:

```text
node --max-old-space-size=256 shared-adapter-check.mjs ../..
```

[Shared implementation](../experiments/execution-engine/witness-adapter.mjs), [runner](../experiments/execution-engine/shared-adapter-check.mjs), [result hashes](../evidence/SHARED_ADAPTER_RESULTS.json). Runtime, dependencies and resource guards are unchanged. The ordinary1241-test offline suite was not rerun or inflated; reference/application modules did not change.

UNRESOLVED — this remains an experimental adapter exposing its diagnostic overlay. It is not a hardened public boundary or a complete StateManager. Inherited methods, malformed callback arguments, direct access to base-class caches and lifecycle transitions need explicit review. Full state-root reconstruction, account creation/absence, arbitrary contract-wallet authority, public-chain authentication and production acceptance remain unproved. Next audit the complete adapter interface and isolate its state from callers before promoting it beyond experiments.
