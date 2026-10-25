# Nested read failure versus ordinary contract revert

FACT — three checks passed through the pinned EthereumJS10.1.3 London interpreter. The outer injected program executes DELEGATECALL and returns its success word. A child reading a proven slot returns1. A child executing REVERT returns0 while the outer program completes and the read session remains usable. A child reading an unselected slot instead throws `WITNESS_STATE_MISSING_SLOT`; the read session then rejects with `REPLAY_READ_FAILED`. Explicitly reverting the state manager afterward does not clear that flag.

[Experiment source](../experiments/execution-engine/nested-read-boundary.mjs) and [validation record](../evidence/ENGINE_NESTED_READ_RESULTS.json). From `experiments/execution-engine`, after the existing frozen installation:

```text
node --max-old-space-size=256 nested-read-boundary.mjs ../..
```

INFERENCE — this tested path distinguishes an ordinary EVM revert, which a caller may handle, from unavailable state evidence, which must invalidate reconstruction. It extends the direct-read probe to an actual nested DELEGATECALL; it does not establish all call opcodes, forks or engines.

Both outer and child bytecode are injected. The adapter checks the selected account/code witness before supplying the child override, but that override is not claimed to match the authenticated runtime. Account/storage reads still pass through the existing proof-backed session. This isolates engine error propagation rather than replaying the retained transaction. No signed transaction, state-root update, value transfer, storage write or journaled write rollback was tested. Ordinary REVERT demonstrates engine handling only; the explicit state-manager revert after the missing read demonstrates failure-flag persistence, not correct write recovery.

The frozen dependency graph is unchanged. Existing1221/1221 offline checks were not rerun or inflated; these three engine checks are a separate result. Network isolation was not independently enforced. The standard resource guards remained in force.

UNRESOLVED — next implement and test a bounded mutable overlay: original values, nested commit/revert and top-level discard must preserve the immutable proof backing. Missing-read failure must remain outside that reversible overlay. Signed executable fixture acquisition, authenticated absence, transaction validity, fork system transitions and public trust anchors remain open. No production or wallet-authority acceptance is asserted.
