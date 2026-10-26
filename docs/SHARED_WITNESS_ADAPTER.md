# Shared bounded witness adapter

FACT —39 grouped checks pass:26 repeated acquired replay groups, eight unsupported-operation groups and five interface/lifecycle groups. They cover the retained local transfer, missing-account, contract increment, revert, storage-clear and refund-cap fixtures. Counts overlap earlier experiments and are not39 independent new scenarios.

The adapter now uses composition instead of inheriting SimpleStateManager. Only explicitly declared callbacks are exposed through a frozen object. Its original-storage cache interface and diagnostic account/storage view are frozen. Internal journals, raw read session and inherited cache stacks are not exposed. Tests that intentionally alter nonce/balance now use the same validated account-write callback as the engine.

Supported callbacks operate on selected proven existing accounts, verified code, selected storage and journal lifecycle. Unsupported code writes, deletion, bulk storage clearing, state-root operations, copying and BAL ingestion invalidate the attempt. Callback exceptions, including tested malformed address input, permanently invalidate it; rollback cleanup remains possible. The diagnostic view checks health and permits discard but no direct write/checkpoint/commit. Storage-write diagnostics are immutable snapshots, not a mutable internal array.

Five added groups cover frozen surfaces/no inherited stacks, attempted callback/cache replacement, immutable diagnostic events, malformed-callback invalidation and post-discard rejection. All earlier acquired comparisons and unsupported-operation checks pass through the new surface. This is defensive API encapsulation within a cooperating JavaScript runtime, not a security boundary against hostile code sharing that runtime.

After frozen dependency installation, from `experiments/execution-engine`:

```text
node --max-old-space-size=256 shared-adapter-check.mjs ../..
```

[Implementation](../experiments/execution-engine/witness-adapter.mjs), [runner](../experiments/execution-engine/shared-adapter-check.mjs), [result hashes](../evidence/SHARED_ADAPTER_RESULTS.json). The previous34-check version and failed storage-guard reproduction remain in Git history and private evidence. Existing dependency/resource guards are unchanged. Ordinary1241-test suite unchanged and not rerun; reference/application modules did not change.

UNRESOLVED — this remains a restricted experimental interface, not a complete StateManager. Unimplemented callbacks are absent, not automatically converted into poisoned-state errors. Complete callback inventory, malformed argument types/lengths, diagnostic growth bounds, fork-specific requirements and downstream lifecycle use need further review. No complete state-root reconstruction, account creation/absence, general contract-wallet authority, public-chain authentication or production acceptance. Next define the supported interface and resource limits explicitly, then test callback edge cases without expanding protocol claims.
