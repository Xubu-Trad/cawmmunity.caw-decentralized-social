# Shared bounded witness adapter

FACT —51 grouped checks pass:26 repeated acquired replay groups, eight unsupported-operation groups five interface/lifecycle groups, eight malformed-input groups and two diagnostic-limit groups and two callback-budget groups. They cover the retained local transfer, missing-account, contract increment, revert, storage-clear and refund-cap fixtures. Counts overlap earlier experiments and are not51 independent new scenarios.

The adapter now uses composition instead of inheriting SimpleStateManager. Only explicitly declared callbacks are exposed through a frozen object. Its original-storage cache interface and diagnostic account/storage view are frozen. Internal journals, raw read session and inherited cache stacks are not exposed. Tests that intentionally alter nonce/balance now use the same validated account-write callback as the engine.

Supported callbacks operate on selected proven existing accounts, verified code, selected storage and journal lifecycle. Unsupported code writes, deletion, bulk storage clearing, state-root operations, copying and BAL ingestion invalidate the attempt. Callback exceptions, including tested malformed address input, permanently invalidate it; rollback cleanup remains possible. The diagnostic view checks health and permits discard but no direct write/checkpoint/commit. Storage-write diagnostics are immutable snapshots, not a mutable internal array.

Five added groups cover frozen surfaces/no inherited stacks, attempted callback/cache replacement, immutable diagnostic events, malformed-callback invalidation and post-discard rejection. All earlier acquired comparisons and unsupported-operation checks pass through the new surface. This is defensive API encapsulation within a cooperating JavaScript runtime, not a security boundary against hostile code sharing that runtime.

After frozen dependency installation, from `experiments/execution-engine`:

```text
node --max-old-space-size=256 shared-adapter-check.mjs ../..
```

[Implementation](../experiments/execution-engine/witness-adapter.mjs), [runner](../experiments/execution-engine/shared-adapter-check.mjs), [result hashes](../evidence/SHARED_ADAPTER_RESULTS.json). The previous34-check version and failed storage-guard reproduction remain in Git history and private evidence. Existing dependency/resource guards are unchanged. Ordinary1241-test suite unchanged and not rerun; reference/application modules did not change.

FACT — callback arity, address bytes/canonical text,32-byte storage keys and0–32-byte storage values are now checked before access. Addresses are copied into the adapter's local type; an initial instanceof-only check rejected a valid engine address from another module instance. That failed run is retained. Canonical byte validation replaces class identity without accepting the tested malformed inputs.

The diagnostic storage-write list is capped at256 records per attempt. The257th write is rejected before modifying state or appending a record, and invalidates the attempt. Reverting a frame does not reset this budget. This is an experimental resource limit, not a CAW or Ethereum rule: otherwise-valid transactions exceeding it are unsupported, not protocol-invalid. Existing whole-process limits remain required.

FACT — supported non-cleanup callbacks and original-storage cache reads share a4096-call per-attempt budget. The4097th call rejects and invalidates the attempt. Revert cleanup is exempt; it cannot restore usability. Cache clear is an intentional no-op on immutable original data and is exempt. Diagnostic read views are outside this callback budget. Whole-process time/memory/output guards are still required. This limit can reject valid transactions and must not be interpreted as consensus invalidity.

| Surface or release gate | Current boundary |
| --- | --- |
| getAccount/getCode/getStorage | Selected proof-backed existing state only |
| putAccount/putStorage | Existing selected state; account nonce/balance only; no root recomputation |
| checkpoint/commit/revert | Journal changes; failures permanent; revert cleanup allowed |
| originalStorageCache.get/clear | Verified original value / no-op clear |
| putCode/deleteAccount/clearStorage | Explicitly unsupported; poisons attempt |
| getStateRoot/setStateRoot/hasStateRoot/shallowCopy/consumeBAL | Explicitly unsupported; poisons attempt |
| Other engine callbacks | Absent; untested execution paths unsupported |
| Resource limits |4096counted callbacks;256diagnostic storage writes; external guarded runtime |
| Arbitrary contract/fork coverage | Blocked; only retained synthetic London examples reproduced |
| Full post-state-root agreement | Blocked; no trie update implementation |
| Public-chain trust/finality and real wallet authority | Blocked; local evidence only |
| Production release | Blocked; these tests do not establish release acceptance |

UNRESOLVED — this remains a restricted experimental interface, not a complete StateManager. Unimplemented callbacks are absent, not automatically converted into poisoned-state errors. Complete callback inventory, additional argument edge cases, diagnostic read frequency, fork-specific requirements and downstream lifecycle use need further review. No complete state-root reconstruction, account creation/absence, general contract-wallet authority, public-chain authentication or production acceptance. Next define the supported interface and resource limits explicitly, then test callback edge cases without expanding protocol claims.
