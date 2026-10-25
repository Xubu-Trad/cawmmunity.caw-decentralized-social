# Released-engine read boundary

FACT — the isolated [experiment](../experiments/execution-engine/read-boundary.mjs) uses EthereumJS10.1.3 and a frozen pnpm lockfile containing17packages. Resolution and installation ran with lifecycle scripts disabled. The frontend and existing offline suite gained no package dependency.

Three separate checks passed through the released EVM's `runCode` path under the London profile: a selected SLOAD returns the proven storage value; an unselected slot throws its original missing-witness error; an unknown account throws its original missing-account error. The two failures also leave the read session permanently invalid. [Validation record](../evidence/ENGINE_READ_BOUNDARY_RESULTS.json).

The adapter uses verified account/code/storage reads and rejects writes. Bytecode is supplied by the test, not authenticated as the selected account's runtime. This checks library integration and error propagation only. It does not execute the fixture's signed transaction, compute a post-state commitment, authenticate the chain, or prove wallet permission. The synthetic-child fixture retains its existing limitations.

## Reproduction

Use Node24.20.0 and pnpm11.25.0. From `experiments/execution-engine`:

```text
pnpm install --frozen-lockfile --ignore-scripts --ignore-workspace --registry=https://registry.npmjs.org
node --max-old-space-size=256 read-boundary.mjs ../..
```

Installation requires registry access; the probe itself makes no explicit network requests. Network isolation was not independently enforced in this run. Dependency integrity is recorded in the lockfile; registry-consistent bytes are not a security audit. Preserve third-party license files when distributing dependencies. No dependency source or installed module directory is committed here.

Checks used the existing768MiB memory/2GiB disk startup requirements,512MiB process limit and300second deadline. The ordinary1221/1221 offline result remains historical and unchanged; these three engine checks are reported separately, not added to that count. No full-suite rerun was needed because existing application/reference sources were unchanged.

UNRESOLVED — bounded journaled writes, authenticated absence, original-storage semantics, nested CALL/revert handling, a genuine signed executable first-transaction fixture, complete transaction validation, trusted headers and state-root comparison. The experimental read adapter is not a general state manager. Next isolate nested-call failure propagation before implementing reversible writes. No production acceptance or release decision follows from this probe.
