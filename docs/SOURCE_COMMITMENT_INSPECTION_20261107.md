# Retained source commitment experiment — 2026-11-07

Status: research only. Parent: `0037310bf7e422fe0d8e4e762b8ff23a482ce87c`.

## FACT

The prior [source-pinned fixture policy](BOOTSTRAP_SOURCE_PIN_POLICY_20261107.md) stores an operator-reference hash in code. This experiment retains the published policy source SHA-256 `59741781544a672c7500a4480dad037d1262f79ebacbc84450056c3028015980` before reading the candidate bytes. That commitment comes from the same operator's prior evidence. It is not an independently acquired trust anchor.

The controlled execution uses the same synthetic metadata, synthetic operator record, selection and dependencies for both variants. Only the embedded operator-reference hash changes from `7dd1be57f1e1624a656cc3ef685945929e5d5bc610211ab8b101af7119f56982` to `fd9fad0b1958cfbbd794123dd32e82acc2777a81ebd6c45f62a8311dc59b5be5`. Original code rejects those inputs. The single-literal replacement admits them as fixture consistency, with authentication and production flags false. The test copies the four fixed dependencies and these two known source variants to a disposable directory for execution; it never executes arbitrary input to the byte inspector.

`inspectSourceCommitment` accepts a nonempty Buffer up to 65,536 bytes and a separately supplied lowercase SHA-256. It checks exact byte equality to that digest without parsing or importing the source. The replacement rejects under the unchanged retained source commitment. If the caller replaces that commitment too, the replacement passes as byte equality only. This boundary is deliberately tested, not hidden behind a claim of authority.

Nine new focused checks passed. A separate regression run passed 26 checks across the existing source-pin, operator-reference, retained-genesis and fork-data tests. These were executed here using Node **v24.22.1**; the declared engine remains **24.20.0**, which was not run. The [machine-readable result](../evidence/SOURCE_COMMITMENT_INSPECTION_20261107.json) records exact commands, source identities, raw logs and runtime identity. This is a partial pinned source snapshot, not a full-suite run or build. Input bytes were unchanged after both runs. Disk, memory, heap and timeout guards were retained. No dependencies were installed. No prior evidence was changed.

## INFERENCE

A previously retained source commitment detects this source substitution while that commitment and the checker remain unchanged. It does not establish the commitment's independent authority, the safety of matching code, dependency integrity, runtime integrity or trusted software delivery. The checker itself is part of the unverified software assumption.

Inspection is **not a secure loader**. No application execution/adoption path invokes it. A caller can inspect one buffer then execute another; mutation after inspection, changed imports or a replaced runtime are outside this check. The result explicitly keeps `executedBytesBound` and `dependencyClosureVerified` false. A successful hash comparison is neither permission to execute code nor proof of authentic network state. There is no new canonical source, automatic fallback or administrator override.

All network/root authentication, independent acquisition, fork schedule, BLS/signature, finality, update and production flags remain false. The historical bootstrap checksum correction remains additive and unresolved as to its original cause. Full suite, declared-runtime testing, build, EVM, live acquisition and hosted CI were not run; hosted CI remains deferred.

## IDEA — next gate

Review an operator-retained software manifest covering the complete import/dependency graph and runtime, with provenance and retention established before acquisition. Test a changed dependency with an unchanged entrypoint, and distinguish byte verification from binding the verified bytes to actual execution. A same-operator sidecar remains a fixture, not independent distribution evidence. Avoid repeating caller-pin wrappers as a substitute for choosing a reviewed trust model. Real network/fork configuration, independent checkpoint sourcing/recency, BLS and update-transition requirements remain separate open gates.

## Reproduce

Run from the repository root with a supported available Node runtime, recording its exact version and binary identity. The executed commands are in the adjacent `run.json`; each used a 45-second process deadline, a 256 MiB Node heap, serial tests and a 30-second test timeout. Require at least 2 GiB free disk and 1 GiB available memory before running.

```sh
node --max-old-space-size=256 --test --test-concurrency=1 --test-timeout=30000 tests/source-commitment-inspection.test.mjs
node --max-old-space-size=256 --test --test-concurrency=1 --test-timeout=30000 tests/pinned-fixture-operator-policy.test.mjs tests/operator-genesis-reference.test.mjs tests/retained-fixture-genesis-binding.test.mjs tests/fork-data-root.test.mjs
```

Project-authored checker, tests and explanation use the repository MIT license. Existing retained fixture material keeps its existing notices. Registration in `package.json` prepares future complete runs; it does not establish one here.
