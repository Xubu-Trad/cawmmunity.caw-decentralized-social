# Permanent failure for a replay read attempt

FACT — `createReplayReadSession(rawText)` reuses the verified witness reader and returns account/code/storage reads plus `assertUsable()`. Any failed read invalidates that session permanently. Catching the original exception cannot restore it: later reads and the final check reject. A fresh session re-verifies the raw evidence. The interface has no reset, rollback or execution-success flag.

Six focused regressions and 1221/1221 offline tests across71files passed. [Validation record](../evidence/REPLAY_READ_SESSION_TEST_RESULTS.json). Run `node --test tests/replay-read-session.test.mjs` for focused reproduction.

INFERENCE — this provides a failure marker outside a future reversible write journal. It is not an execution engine or a security boundary against a malicious caller. The eventual adapter must use this same session for every backing read and check it before accepting any result. It must not discard a failed session and accept a replacement as the same execution. Tests cover caught and swallowed failures with ordinary JavaScript calls, not actual EVM nested calls or journal rollback.

## Candidate release evidence

FACT — five direct EthereumJS candidate package archives, each version10.1.3, were downloaded from the npm registry and matched their advertised SHA-512 integrity values. [Exact URLs, hashes, versions, licenses and dependency ranges](../evidence/EXECUTION_ENGINE_CANDIDATE_PINS.json) are retained. All report gitHead `29f404f305be4473907d4aa4f7ece85633bb73da`, distinct from the earlier moving-branch review. The released statemanager's ESM code still supplies empty bytes for missing code/storage. Registry integrity establishes byte consistency with that registry record, not an independent security audit or maintainer identity proof.

UNRESOLVED — these five pins are not a complete transitive lock. No packages or lifecycle scripts were installed or executed. License fields are recorded per package; third-party licenses remain separate from this project's code-only MIT grant. No engine compatibility or successful replay is established.

Next: resolve and lock the full dependency graph, inspect the released API, implement bounded journaled state and prove missing-read propagation through real execution. Acquire an executable signed first-transaction fixture; the existing synthetic-child fixture remains unsuitable for a successful replay claim. Production, wallet authority and execution acceptance remain false.
