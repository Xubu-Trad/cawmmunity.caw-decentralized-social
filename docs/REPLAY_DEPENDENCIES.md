# Selected replay dependency proofs

FACT — `inspectReplayDependencies(text)` verifies an explicitly declared set of existing accounts, storage slots and runtime bytes against one selected header. It reuses the header-bound code and account/storage proof readers. No network or EVM is invoked.

The exact JSON schema `caw-replay-dependencies/1` contains `header`, `selection`, `witnesses`. Selection contains `profile`, `parentHash`, `dependencies`; each dependency contains `address`, `storageKeys`, `expectedCodeHash`. Witnesses have `proof` and `code`, in the matching order. A nonempty set of up to16 distinct accounts is required; each inherited proof reader allows at most16 selected slots. Total JSON is bounded to1MiB, with inherited per-proof limits. Extra/missing witnesses, duplicate accounts and mismatched code/storage proofs reject. Existing-account proofs are required; absence witnesses are not supported by this code-reader composition.

Each runtime must match both the proven account code hash and the separately selected expected hash. Replacing the runtime and its selected hash together still fails against the unchanged account proof.

UNRESOLVED — selection names this header as a parent, but this standalone reader does not establish its relationship to a child transaction. `parentChildBindingVerified` remains false. The previous first-transaction anchor supplies that separate check; automatic composition is not yet implemented. The selected test header is a retained local branch endpoint used as a candidate parent, not a newly observed parent/child execution.

`selectedDependenciesVerified` means the declared proofs pass. It does not mean the declared list is complete. `dependencyClosureVerified`, `parentStateAuthenticated`, `preTransactionStateVerified`, `executionVerified`, `accountAuthorityVerified` and `productionAccepted` remain false. No storage layout or wallet authorization is inferred from arbitrary proven slots. Fork-specific system transitions and execution-dependent external calls remain unhandled.

## Verification

Nine regressions use the retained signed-withdrawal fixture's registry and four storage proofs. They cover a valid selection, missing and extra witnesses, duplicate accounts, missing slots, changed runtime, paired runtime/hash replacement, alternate-branch proof substitution, injected completeness claims and empty-set rejection. Full suite1200/1200 across68files passed. [Validation](../evidence/REPLAY_DEPENDENCY_TEST_RESULTS.json).

```text
node --test tests/replay-dependencies.test.mjs
```

Next: compose this reader with the first-transaction anchor using exact parent-header equality, then require every execution access to use a proven account/slot/code entry. Unknown accesses must reject rather than fall back to an RPC or assumed zero. Dependency completeness can only be assessed with the actual execution path and fork rules.
