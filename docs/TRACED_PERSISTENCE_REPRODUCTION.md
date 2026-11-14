# Pinned inputs for tracing-aware persistence reproduction

The tracing-aware experiment now has its own 17-file input manifest. It pins public source commit `5ced0bcc0427672c959b54cb3b7d8ba5fad4b586`, covering the historical 14-file experiment plus `run-header-sync-early-trace.py`, `tracing-capability.py` and `test-tracing-failures.py`.

Canonical manifest SHA-256: `7b11dd82432b189a77b9928b60e42c7345a6991d48898941fdc67c3d5185620e` (JSON sorted keys, compact separators). The verifier embeds both this fingerprint and the source commit. The older manifest/verifier remain unchanged; do not use their pass as authentication of the newer tracing files.

## What was checked

All 17 files were freshly downloaded from the pinned public GitHub source. The original 14 retain their previous byte hashes. Seven checks passed: genuine input acceptance; changed file, missing file, changed manifest and external symlink rejection; and individual mutations of the new tracing helper and driver. The current explicitly trusted tools' version/hash inventory also completed.

This is source acquisition and preflight verification by the same operator on the existing host. No new nodes were started and no new independent recovery result is claimed. The earlier supported local recovery remains 29 matching headers, 16 storage fields and five rejection controls. ahdmesh's independent R-04 execution remains blocked by tracing permissions.

## Reproduce

Use an authorized Linux environment with tracing support. Preserve a checkout at the pinned source commit as `SOURCE`. Obtain and review this revision's `traced-persistence-preflight.py`, `test-traced-persistence-preflight.py`, and `evidence/traced-inputs-20261112/inputs.json` together; keep the two Python scripts beside each other. Their provenance is separate from the 17-file experiment manifest. Trust in the verifier itself and repository provenance remains an explicit prerequisite.

Set `PREFLIGHT` to that verifier's path, `MANIFEST` to the manifest, `GETH` to your trusted executable, `RETH_COMMAND_JSON` to your reviewed executable/loader argument array, and `OUTPUT` to a fresh evidence directory. Version commands execute those supplied tools. Paths must refer to your environment, not the original operator's filesystem.

```sh
mkdir "$OUTPUT"
python3 "$PREFLIGHT" \
  --source "$SOURCE" --manifest "$MANIFEST" \
  --geth "$GETH" --reth-command "$RETH_COMMAND_JSON" \
  --output "$OUTPUT/preflight.json" && \
python3 "$SOURCE/integration/peer-sync/reproduce-persistence.py" \
  --driver "$SOURCE/integration/peer-sync/run-header-sync-early-trace.py" \
  --geth "$GETH" --reth-command "$RETH_COMMAND_JSON" \
  --fixture "$SOURCE/integration/peer-sync/fixture" \
  --output "$OUTPUT/execution" \
  --reader "$SOURCE/integration/core-baseline-v1/check-geth-header-proof.mjs" \
  --expected "$SOURCE/evidence/registry-later-20261109/result.json"
```

The `&&` requires a successful preflight before execution. Use a trusted, unchanged checkout between checking and executing; this is not protection against concurrent replacement of local files. The driver retains its 2 GiB disk and 1 GiB available-memory checks. It then probes tracing before node initialization. A small probe pass does not guarantee Reth startup or successful interruption timing.

For the seven input controls, run the sibling `test-traced-persistence-preflight.py` with `--source "$SOURCE" --manifest "$MANIFEST"`. It creates temporary copies and changes only those copies. Tool binaries, runtime libraries and the kernel are not authenticated by the input manifest. See the existing client-signature and runtime-provenance reports for their separate trust boundaries.

## Independent result to return

Record the exact source and verifier revisions, manifest fingerprint, tool inventory and environment. Preserve the entire fresh output, including a failed probe or failed execution. Before publishing, remove secret JWT/key material and check logs for personal paths; keep a private original and document any redaction.

Successful execution must retain the wrapper's existing assertions: interruption before the completion marker, isolated restart with original identity, no original source running, a different replacement peer, all 29 matching headers, 16 proof fields and all five negative controls, and stopped services. A preflight-only pass or a trace-only pass is not a recovery pass. Public-chain consensus authentication, finality and power-loss durability remain outside this synthetic experiment.


## Single-command option

[The tested runner](TRACED_PERSISTENCE_RUNNER.md) now connects these steps without manually selecting the driver or reader. The historical instructions and manifest remain unchanged.
