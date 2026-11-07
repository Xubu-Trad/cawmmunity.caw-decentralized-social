# Dependency substitution under unchanged entrypoint — 2026-11-07

Research only. Parent: `e6804788fcafc3ea1c37a08f5794b4e0c44f8bc8`.

## FACT

The [prior byte inspector](SOURCE_COMMITMENT_INSPECTION_20261107.md) explicitly does not verify imports or bind inspected bytes to execution. This follow-up reproduces that boundary without adding another inspector API or changing application behavior.

A retained inventory records SHA-256 and size for the five reviewed local modules reached by the fixture policy: the policy entrypoint, operator comparator, metadata selector, profile selector and fork-data checker. Its digest is fixed in the test before constructing the substitution. The inventory is same-operator fixture evidence, not independently authenticated software distribution. Node builtins, runtime, test harness and checker are outside this five-file inventory.

The controlled experiment changes exactly one literal in `reference/operator-genesis-reference.mjs`: `networkAuthenticated:false` becomes `networkAuthenticated:true`. Original entrypoint bytes, the other four modules and all call arguments stay fixed. Both variants execute only in disposable directories using reviewed local source and this explicitly generated negative control. No altered module is installed in the repository or application.

The original returns false; the altered dependency returns true for that flag, with every other result field unchanged. **This is a deliberately false report, not network authentication.** Production acceptance and update flags remain false even in the control. The unchanged entrypoint still passes its retained SHA-256 check. Comparing all five files against the unchanged inventory rejects the altered dependency. Separate controls reject a missing or unexpected file.

Five new focused tests passed. A separate 35-check regression passed across source inspection, source-pin policy, operator comparator, retained-genesis and fork-data tests. Node v24.22.1 was executed; declared Node 24.20.0 was not. Tests used a Git-blob-verified partial snapshot, not a complete checkout or full-suite run. Resource guards required 2 GiB free disk and 1 GiB available memory, with a 256 MiB heap, serial tests, 30-second test timeout and 45-second process deadline. Input bytes were checked unchanged after execution. Exact commands, runtime binary identity, retained TAP logs and artifact hashes are in [the result](../evidence/DEPENDENCY_SUBSTITUTION_20261107.json).

## INFERENCE

An unchanged entrypoint hash cannot establish the behavior of imported code. The explicit five-file comparison detects this particular dependency substitution under an unchanged inventory and unchanged checker. It is not a general dependency resolver, runtime attestation, sandbox or secure loader. It does not prove that the inventoried files are the ones eventually executed. A replaced inventory, test/checker, Node builtin or runtime remains outside the demonstrated protection. Matching code can still contain defects.

The hostile control also demonstrates why a module's self-reported boolean must not be treated as independent evidence of its own trustworthiness. The retained original research modules continue to report false authentication and acceptance flags. This increment modifies no production code, recovery adoption, consensus/BLS validation, fork policy or trust source. It introduces no privileged override or automatic fallback.

No full suite, declared-runtime run, build, EVM, live acquisition or CI was executed. Hosted CI stays deferred. Existing historical evidence and its additive checksum correction remain unchanged.

## IDEA — next experiment

Hold the reviewed inventory fixed, verify all five inputs, then substitute one dependency between inspection and import. Demonstrate the check-to-use gap before proposing a bounded mechanism that executes the exact verified snapshot. Review dependency resolution, path aliases, dynamic imports, runtime identity and independent manifest retention separately; do not claim a generic secure loader from five local files. Real network/fork, checkpoint provenance/recency, BLS and update-transition gates remain open.

## Reproduce

The exact two guarded process commands are retained in `evidence/dependency-substitution-20261107/run.json`. The new focused command is:

```sh
node --max-old-space-size=256 --test --test-reporter=tap --test-concurrency=1 --test-timeout=30000 tests/dependency-substitution.test.mjs
```

Registration in `package.json` prepares future full runs without claiming one here. Project-authored tests, inventory and documentation follow the repository MIT license; existing fixture material retains its existing notices.
