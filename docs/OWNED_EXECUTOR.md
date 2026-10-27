# Owned process and result inspection

FACT -- one real Windows supervisor run launched a guarded worker, observed its successful exit, then launched a separate guarded inspector. The inspector accepted the local storage-increment result (gas 26012) against expected identities independently selected by the supervisor. Nine separate synthetic transport cases passed: normal record, wrong request ID, altered bytes, truncation, missing/duplicate/nonterminal marker and failed/interrupted completion.

The supervisor requires a new evidence directory, copies bounded input there, verifies the known base/executor manifest hashes and derives expected source identities from that selected base manifest. It generates a fresh 128-bit request ID. The worker emits a final stdout marker containing that request ID and the SHA-256 of the exclusively created result file, after writing it. The supervisor captures the actual child return code, bounded stdout and bounded result bytes into an inspection packet. The inspector requires exactly one terminal marker, matching request ID and file digest, then applies the strict result inspector. Each child receives its own Windows job/resource guard, with the previous job closed before the next starts.

From experiments/execution-engine on Windows, with Python 3.12 and the pinned Node 24.20.0 executable:

```text
python -I -B run-owned-executor.py ../.. PATH_TO_NODE_EXE PATH_TO_INPUT_JSON NEW_EVIDENCE_DIRECTORY
node --max-old-space-size=256 owned-output-check.mjs ../..
```

Use the fixture preparer in [fresh-process execution](EXECUTOR_PROCESS.md) for input. The supervisor enforces the retained 768 MiB startup memory, 2 GiB disk, runtime/guard pins, 512 MiB child job limit, 300-second deadline per child and 10 MiB log limit. It clears inherited Node loader options by constructing a minimal environment. No network acquisition, installation or state adoption occurs. Earlier CLI calls without the optional request ID remain supported; the supervisor requires the correlated mode.

[Supervisor](../experiments/execution-engine/run-owned-executor.py), [transport inspector](../reference/executor-output.mjs), [evidence](../evidence/OWNED_EXECUTOR_RESULTS.json). Synthetic transport tests derive their expected metadata from a fixed fixture to isolate transport behavior; the real supervisor derives expectations separately from pinned manifests and copied input. These scopes are distinct.

INFERENCE -- replacement of the result with different bytes is detected relative to captured worker stdout. A mismatched request marker prevents accepting another invocation's captured completion. The request ID is not a signature or secret. Someone who controls the worker, stdout, inspection packet or trusted host can forge matching data. Identical result bytes from identical input are not distinguishable merely by hashing; trust in the new directory and owned process still matters.

UNRESOLVED -- filesystem races, trusted supervisor/inspector code, host compromise, loaded dependency identity, runtime signer verification, full state roots and independent reproduction. The result remains executionAuthenticated=false and productionAccepted=false. No cryptographic execution proof is claimed. Prior 28/13/66/1241 suites were not rerun. Next review the complete authority/dependency graph and independent reproduction boundary before connecting these local observations to any state adoption.
