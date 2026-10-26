# Selected local London executor

FACT -- 13 focused groups pass through a new fixed-executor wrapper. Five retained signed fixtures produce the expected outcomes and gas: transfer 21000, storage increment 26012, revert 26018, slot clear 21206 and capped refund 24810. Missing storage evidence returns missing-evidence without a gas result. Negative checks reject wrong base/executor manifest identities, a supplied fifth callback argument, malformed/oversized input, changed source bytes and an omitted selected source entry. The source-byte/omission checks exercise the selection verifier directly; original source files were not changed on disk.

The wrapper takes four arguments: repository URL, exact input text, separately selected base-manifest digest and separately selected executor-manifest digest. It verifies the existing 21-file manifest and a separate exact two-file selection (selected-london-executor.mjs plus esm-package-entry.mjs). It imports the fixed executor itself instead of accepting a callback. The result carries a frozen executorSelection digest/file count alongside the existing input/source provenance and conservative outcome flags.

The executor is deliberately limited to London, chain ID 31337 and transaction index zero. It reconstructs the transaction/block from the already witness-validated input, checks signature and selected hashes, and runs the VM with the proof-backed adapter. Its tx/block entrypoints use the separately exercised ESM resolution path. No original harness, dependency version, adapter or base source manifest changes.

After frozen installation, from experiments/execution-engine:

```text
node --max-old-space-size=256 selected-executor-check.mjs ../..
```

Review [the wrapper](../experiments/execution-engine/selected-executor-gate.mjs), [executor](../experiments/execution-engine/selected-london-executor.mjs), [selection](../experiments/execution-engine/executor-selection.json) and [results](../evidence/SELECTED_EXECUTOR_RESULTS.json). The test explicitly pins both expected digests; automatically accepting a newly regenerated selection defeats that boundary.

INFERENCE -- the API now ties a bounded local outcome to a selected executor source pair rather than arbitrary caller-supplied callback code. It remains a local identity check, not a cryptographic execution proof.

UNRESOLVED -- the gate itself and existing verifier are trusted host code; their identity must be selected by the reviewer. The gate/test hashes are recorded in the evidence but not self-authenticated. File checks precede normal file-URL imports: concurrent replacement and previously populated module caches remain risks. Installed transitive modules are not covered by this selection, nor is runtime signer trust. The new 13 groups compare outcomes/gas, not final account/storage values or full roots; prior harness comparisons remain separate evidence. No independent public-chain authentication, production acceptance or release agreement.

The earlier 66 replay groups and 1241 ordinary offline tests were not rerun for this addition and are not added to the 13-group count. Existing resource guards stayed active. Next define and test a fresh-process execution boundary that checks selected source before loading and binds its result to the input/selection, while keeping unresolved filesystem and dependency assumptions explicit.
