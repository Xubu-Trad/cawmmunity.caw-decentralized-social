# Execution threat model and next experiment — 2026-11-07

Status: **proposed research scope, not implemented or accepted production policy**.
Parent: `d5f3d229098d4318c22a33af3fc5007f3ea7d24b`.

## FACT — demonstrated boundary

[Source replacement](SOURCE_COMMITMENT_INSPECTION_20261107.md), [dependency replacement](DEPENDENCY_SUBSTITUTION_20261107.md) and [inspection-to-import ordering](VERIFIED_IMPORT_BOUNDARY_20261107.md) establish distinct limits. Matching an entrypoint does not verify imports. Checking all five files does not bind later path reads. Capturing the checked buffers resisted acquisition-path replacement, but the writable execution copy still admitted the same substituted dependency. These are retained results, not new runs in this increment. A corrupted module's reported authentication flag was not independent proof of authentication.

This increment records the threat model, exact local import graph and required experiments. It adds no loader, runtime dependency, production behavior or new test-pass count. The last executed groups remain 4 focused and 40 separate regression tests on Node v24.22.1; declared Node24.20.0 and full suite were not run.

## IDEA — supported actor and assumptions

The next bounded candidate may protect against an acquisition-file writer: an actor who replaces the five source files before or after capture but cannot alter the previously retained inventory, reviewed checker/linker, private captured state, host runtime or OS isolation boundary. This is a deliberately narrower model than a compromised user account or host. Whether an actual deployment enforces that separation is unresolved; the experiment alone cannot establish it.

| Surface | Proposed treatment | Remaining limitation |
|---|---|---|
| Acquired source files | Untrusted, exact inventory and digest check before evaluation | Origin is not authenticated by byte equality |
| Retained inventory | Fixed before capture and not accepted from the acquired source tree | Same-operator fixture provenance; independent delivery and selection remain open |
| Module linking | Exact parent/specifier edges from the reviewed five-module graph | Not a generic resolver or npm dependency closure |
| Captured bytes | Private copied bytes used directly for evaluation; no later file-backed source import | No protection against arbitrary process-memory modification |
| Host capabilities | Only reviewed fixture needs: Buffer and SHA-256 createHash; reject unsupported imports | Host runtime/builtins and bridging code remain trusted assumptions |
| Checker/runtime/OS | Outside the acquisition-file adversary's control | Same-identity or privileged replacement is not covered |

Do not claim that a temporary directory or file permissions alone enforce these assumptions. An actor permitted to replace the checker or runtime can change both checks and reported flags. Neither provider agreement nor a hash sidecar establishes independent manifest authority.

## IDEA — bounded candidate behavior

1. Verify the independently retained *test commitment* and exact five-entry inventory before evaluating any source. Here that commitment remains a same-operator fixture, not a selected live trust policy.
2. Copy each candidate input into privately owned bytes and hash that same copy. Admit exactly the listed paths, sizes and digests within explicit per-file and total byte limits. Refuse any mismatch before evaluation.
3. Evaluate/link only those captured sources through an explicit closed graph. Never create a writable file-backed execution tree and then use normal filesystem imports. Never fall back to native/default resolution after a failure.
4. Reject every unlisted parent/specifier edge, alternate builtin, path alias and dynamic import. Keep a fresh module registry per attempt. The proposed graph and bounds are in [the machine-readable plan](EXECUTION_RESEARCH_PLAN_20261107.json).
5. Record the exact host runtime identity and supported capability decision before execution. A module-evaluation API has **not** been selected or verified in this increment. Review its pinned official documentation and runtime behavior before coding. If unavailable, record NOT_RUN; do not silently switch mechanisms or relax runtime requirements.
6. Retain the fixture result only after the whole admitted graph evaluates and the call completes. No partial success, automatic fallback or update adoption. Every actual trust/acceptance claim remains false.

This would test binding a small reviewed source graph to an evaluation attempt under stated host assumptions. It must not be presented as a sandbox for malicious JavaScript or a general secure loader. Input authority, manifest provenance, cryptographic correctness and chain authentication are separate questions.

## Required experiments — all NOT_RUN for the proposed candidate

| ID | Controlled trigger | Required observation |
|---|---|---|
| EX-01 | original captured graph | entire fixture result equals retained direct-call control |
| EX-02 | replace dependency before capture | digest mismatch rejects before any module evaluation |
| EX-03 | replace acquisition dependency after capture | captured original result unchanged; no source reread |
| EX-04 | supply missing or extra module | reject exact module inventory before evaluation |
| EX-05 | request unlisted static import, path alias or alternate builtin | reject exact parent/specifier edge; no default resolver |
| EX-06 | request dynamic import | reject without filesystem or network fallback |
| EX-07 | mutate caller-owned buffers after admission | private captured copy result unchanged |
| EX-08 | link or evaluation failure | return failure, no partial result or alternate loader |
| EX-09 | fresh repeated execution | no module cache shared across attempts |
| EX-10 | attempt source read/write/network during execution | no explicit I/O capabilities supplied; do not claim a hostile-code sandbox |
| EX-11 | runtime API unavailable or wrong supported runtime | refuse unsupported mode; record NOT_RUN, no native-import fallback |
| EX-12 | replace retained inventory or checker/runtime | outside supported protection; negative demonstration must not be called authenticated execution |

Change one variable per negative control. A case about linking policy may use a small authored control module to exercise the linker, but its evidence must be separated from admission under the unchanged five-file fixture inventory. Otherwise an early digest rejection cannot demonstrate that the linker itself refuses the import. The same distinction applies to dynamic-import and capability tests.

## Exit criterion and next work

The next increment is a runtime-feasibility review and bounded prototype only if the chosen API can evaluate captured bytes with explicit import resolution. It must reproduce EX-01 through EX-11 with retained outcomes, attribute EX-12 as an unsupported trust assumption, and compare against the earlier writable-destination counterexample. If that cannot be demonstrated, retain the failure and stop promotion. No production loader or recovery integration is authorized by this design document alone.

Do not add more source-pin wrappers as a substitute for this gate. After the bounded mechanism is reviewed, return to independent manifest/checkpoint sourcing, real network/fork configuration, recency, BLS validation and update transitions. Software-byte consistency does not close those protocol gates. Hosted CI stays deferred. No build, EVM, live acquisition, runtime test or full suite ran for this documentation increment. Original project documentation is MIT-covered; retained third-party evidence keeps its notices.
