# Single-command tracing-aware persistence reproduction

The new runner selects the pinned wrapper, early-tracing driver, fixture, strict proof reader and expected-state file automatically. It verifies all 17 inputs before invoking tools, runs the existing tool preflight, checks its output fingerprint, rechecks inputs after tool inventory and only then starts recovery. It preserves logs and exit codes in a fresh evidence directory. It does not replace the underlying verifier or relax any recovery assertion.

## Command

Keep `reproduce-traced-persistence.py` beside the reviewed `traced-persistence-preflight.py` from this revision. Review and pin both orchestration files separately from the experiment's 17-file manifest. Obtain the experiment inputs and manifest as described in [the pinned-input instructions](TRACED_PERSISTENCE_REPRODUCTION.md).

```sh
python3 integration/peer-sync/reproduce-traced-persistence.py \
  --source "$SOURCE" --manifest "$MANIFEST" \
  --geth "$GETH" --reth-command "$RETH_COMMAND_JSON" \
  --output "$FRESH_OUTPUT"
```

The output directory must not exist; its parent must exist. The executable paths and Reth loader arguments are explicitly trusted operator inputs. The source directory must remain unchanged during execution; repeated hash checks do not eliminate concurrent replacement attacks. Existing tracing, disk and memory guards remain mandatory. Do not treat unsupported tracing as a passing run.

## Validation

Seven mocked orchestration controls passed: changed input, missing input, existing output, failed preflight, successful exit without a preflight record, input mutation during inventory, and recovery failure. They establish dispatch/rejection behavior, not node recovery. The last case also checks selection of the exact early-tracing driver and strict reader. Repeat with `python3 integration/peer-sync/test-traced-runner.py --source "$SOURCE" --manifest "$MANIFEST"`.

A separate real run of the single-command entry point completed on the existing local host. After interruption, the destination restarted at genesis with its identity preserved and no peers. A different replacement peer supplied all 29 matching headers. The unchanged strict reader accepted 16 storage fields and rejected all five controls. All experiment services stopped. See [the scoped result](../evidence/traced-runner-20261112/result.json).

This validates the new orchestration against the real local experiment. It is not an independent operator result, public-chain authentication, finality proof, power-loss durability proof or production readiness assessment. ahdmesh's independent R-04 remains environment-blocked. A successful input check or process exit is not by itself a recovery claim; the pinned wrapper enforces the original interruption, isolation, proof and cleanup assertions.


## Acquiring the complete input set

[The download-only acquisition tool](PERSISTENCE_INPUT_ACQUISITION.md) now supplies all 20 pinned files, including this runner and its verifier, before any execution.
