# Local replay input and source provenance

FACT —63 grouped checks passed: the preceding59 regression/outcome groups run with the provenance wrapper, plus four input-identity/boundary groups. The wrapper constructs its own witness adapter from the supplied bounded JSON input, invokes a trusted callback with that adapter, and closes the attempt afterward.

Every returned frozen report includes SHA-256 of the exact UTF-8 input, pnpm lockfile, adapter source, outcome source and binding-wrapper source. The provenance object is also frozen. Reports contain no file paths. Input is limited to1MiB UTF-8; each provenance file is limited to128KiB. Malformed or oversized input rejects before invoking the callback. These setup failures throw rather than returning an execution outcome.

Repeated identical input produces identical provenance. Whitespace-only input changes preserve the tested execution/gas result while changing the exact-input hash. All normal/reverted/missing/unsupported/resource/unknown/malformed-result/swallowed-error outcome tests remain in the run. Earlier51 adapter groups are also included, not newly counted as independent scenarios.

From `experiments/execution-engine`, after frozen installation:

```text
node --max-old-space-size=256 bound-replay-check.mjs ../..
```

[Wrapper](../experiments/execution-engine/bound-replay.mjs), [checks](../experiments/execution-engine/bound-replay-check.mjs), [result hashes](../evidence/BOUND_REPLAY_RESULTS.json).

INFERENCE — hashes make the reported input/source identity inspectable and help detect accidental report/input mismatches. They do not authenticate an untrusted report, prove the callback executed that input, attest installed package bytes or establish a trustworthy chain root. The lockfile identifies intended dependencies only. Source files are read from disk at report construction; no protection against concurrent file replacement or differing loaded module bytes is claimed. Imported reference modules are not yet included in this limited source manifest. installedEngineAttested remains false, as do state comparison, root, public-chain and production flags.

UNRESOLVED — a complete pinned artifact manifest, installed-dependency verification, exact executor/input linkage, independent reproduction and strict external-report validation. Next bind a complete source manifest and verify the expected manifest before execution, while preserving these trust distinctions. Existing guards/dependencies unchanged; ordinary1241-test suite unchanged and not rerun.
