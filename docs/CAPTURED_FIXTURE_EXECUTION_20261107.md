# Captured fixture execution prototype — 2026-11-07

Research only. Parent: `b8d66ce0eb96112b0e7eceff2a6467e3fa176d72`.

## FACT — runtime and implementation

The [execution threat model](EXECUTION_THREAT_MODEL_20261107.md) now has an isolated prototype in `experiments/captured-fixture/`. The retained five fixture modules are unchanged; the application and recovery paths do not invoke the prototype.

The [versioned Node v24.22.1 VM documentation](https://nodejs.org/download/release/v24.22.1/docs/api/vm.html) describes SourceTextModule/SyntheticModule as experimental flag-gated APIs and explicitly warns that VM contexts are not a security mechanism. SourceTextModule accepts source text, supports a custom linker, and permits a rejecting dynamic-import callback. Local capability probes found both constructors absent without `--experimental-vm-modules` and present with it. The prototype checks the exact observed runtime version and constructor availability; no default-loader fallback exists. This pin establishes supported test behavior, not runtime authenticity. The repository's declared Node24.20.0 was not executed and is deliberately unsupported by this experimental prototype pending review.

`captureFixture` takes exactly one Map containing the five expected paths and Buffer inputs. The reviewed fixture inventory hashes and exact import graph are embedded in this research source; no caller-supplied replacement pin or graph is accepted. Every input is copied, checked for exact size and SHA-256, and retained as a private source string before graph evaluation. Later caller-buffer mutation, Map deletion or acquisition-directory deletion cannot change those strings.

Each call constructs fresh VM modules and a fresh context. Static imports must match the reviewed parent/specifier edges; attributes, absent targets and unlisted imports reject. Dynamic imports reject through their callback. The graph uses only captured source strings, with no writable execution copy or default filesystem resolver. Its explicit host bridges are Buffer and SHA-256 createHash. These bridges, checker, runtime and OS remain trusted assumptions, not a hostile-code sandbox. A one-second synchronous timeout covers top-level evaluation and invocation; asynchronous stalls still require the external process deadline.

`graph-engine.mjs` is a lower-level research component with an exported function for authored controls. It has **no source-authority admission** and must not be substituted for `captureFixture`. Its permissive authored-control entrypoint demonstrates that untrusted code can return invented flags. It is not exposed through the application. Plain Maps, Buffers and ordinary arguments are assumed; adversarial same-process proxies, memory modification or runtime replacement are outside the threat model.

## FACT — executed evidence

The initial 13-check focused run passed. Four targeted tests were then added for engine size limits, import attributes, restricted hash algorithm and synchronous timeout. The final focused group passed **17/17**, and a separate existing-regression group passed **44/44**. Do not add the initial count to the final count or historical full-suite totals. The original 13-test source, command and log remain retained under `evidence/captured-fixture-20261107/attempt-1-*`; the final source and logs have their own identities in [the result](../evidence/CAPTURED_FIXTURE_EXECUTION_20261107.json). No failed test or publication attempt is claimed.

| Plan case | Observed scope |
|---|---|
| EX-01 | Entire fixture result equals the retained direct-call result |
| EX-02, EX-04 | Altered/missing/extra/renamed/malformed/oversized inputs and extra pin argument reject at admission |
| EX-03, EX-07 | Deleting acquisition files or mutating caller buffers after capture leaves the original result unchanged |
| EX-05 | Authored controls exercise static-edge checks and a missing-target linker rejection separately from fixture digest admission |
| EX-06 | Authored dynamic import reaches the rejecting callback |
| EX-08 | Parse, linking, evaluation and invocation failures return no partial result; wrong call arity rejects |
| EX-09 | Repeated evaluation starts with fresh module state |
| EX-10 | No explicit process, require, fetch or filesystem-import capability is supplied; no sandbox guarantee follows |
| EX-11 | Fresh process without flag rejects; altered version-label control rejects, without claiming another binary was run |
| EX-12 | Authored raw-engine code can report invented authority; fixed-fixture admission rejects replacement source. Manifest/checker/runtime replacement remains outside protection |

The earlier writable-destination counterexample reran as part of the separate 44-test regression. This candidate avoids creating that execution destination; it does not turn the earlier filesystem approach into a secure one.

## INFERENCE — bounded conclusion

Under the retained inventory, checker and runtime assumptions, the tested fixture executes from its captured local module strings despite the defined acquisition mutations. This establishes a limited execution property for five reviewed modules. It does not authenticate the source pin, software distribution, runtime, live chain, consensus, signatures, finality or production acceptance. Every actual authentication/acceptance flag remains false. Matching code can still contain defects. Host-object bridges and VM contexts do not safely isolate hostile JavaScript.

The runtime restriction is local to this experiment. No Node engine declaration, default test command, network selection, BLS implementation or application adoption behavior changes. The public result records Node v24.22.1 and its binary SHA-256. Declared-runtime testing, complete suite, build, EVM, live acquisition and CI were not run. Hosted CI stays deferred. Prior evidence and additive checksum correction are intact.

## Reproduce and next gate

Run `npm run test:captured-fixture` using Node v24.22.1. It is a separate opt-in research command; ordinary `npm test` does not gain an experimental VM flag. Before execution require 2 GiB free disk and 1 GiB available memory, and use a 45-second process deadline. The retained command sets a 256 MiB heap, serial tests and a 30-second test timeout. No dependencies are installed. Exact focused and regression commands are retained in `evidence/captured-fixture-20261107/run.json`.

IDEA — Obtain review/reproduction of this bounded execution mechanism and independently retained source/runtime provenance. Do not expand it into a generic package loader or infer a live checkpoint policy. Return to the bootstrap trust checklist: separately justified checkpoint origin/retention, real supported network/fork and recency rules, and BLS/consensus update prerequisites. A future protocol-validation experiment must state its exact external vectors and unsupported modes before any acceptance behavior changes. The runtime/manifest trust assumptions remain explicit blockers rather than reasons for another chain of self-selected hash wrappers.

Project-authored prototype, controls and explanation follow the repository MIT license; existing third-party fixtures retain their notices.
