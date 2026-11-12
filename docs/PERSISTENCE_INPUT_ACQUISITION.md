# Download-only acquisition for persistence reproduction

The acquisition tool embeds exact commit, size and SHA-256 pins for all 20 required files: the 17 experiment inputs from `5ced0bcc0427672c959b54cb3b7d8ba5fad4b586`, plus the runner, preflight verifier and input manifest from `7c1d9922bdfd4a43359bdcc85986b761797a71e4`. It uses no moving branch and requires no local copy of the original operator's source files.

## Use

Review and retain this revision's acquisition script first. Trust in that bootstrap script and its published pins remains explicit. The tool only downloads and verifies bytes; it does not install clients, execute downloaded code or attest that the code is safe.

```sh
python3 integration/peer-sync/acquire-persistence-inputs.py --output "$FRESH_SOURCE"
```

The destination must not exist. Success writes `ACQUISITION.json` with `inputs-verified` and 20 verified files, plus per-file provenance. A transfer mismatch, network failure or handled interruption writes `blocked` and retains partial evidence. Never reuse a partial directory. Download reads are bounded to each expected size plus one byte; there is a 45-second timeout per request. Uncatchable termination or power loss can prevent status writing and is not a verified acquisition.

After inspecting the verified input set and selecting trusted client binaries/runtime, use:

```sh
python3 "$FRESH_SOURCE/integration/peer-sync/reproduce-traced-persistence.py" \
  --source "$FRESH_SOURCE" \
  --manifest "$FRESH_SOURCE/evidence/traced-inputs-20261112/inputs.json" \
  --geth "$GETH" --reth-command "$RETH_COMMAND_JSON" \
  --output "$FRESH_RUN"
```

The acquisition success is not execution permission or a recovery result. The separate runner rechecks inputs and invokes the unchanged resource, tracing, interruption, recovery and proof checks. Keep the source directory trusted and unchanged between these steps; this is not protection against a hostile local process racing filesystem writes.

## Evidence and tests

Twenty files were acquired from public pinned URLs and matched their sizes/hashes. Seven offline controls passed: genuine fixture acceptance, altered/truncated/oversized data rejection, unavailable-source rejection, handled-interruption rejection and refusal to overwrite an existing output. These tests use the verified local input set as their transport fixture and execute no downloaded node code. The interruption test exercises the final error-preservation path; the successful public transfer preceded that error-path refinement.

Repeat controls with `python3 integration/peer-sync/test-acquisition.py --fixture "$FRESH_SOURCE"`.

No new node recovery was run for this acquisition-only change. The preceding real local runner result remains 29 matching headers, 16 storage fields and five negative controls with all services stopped. Independent operator recovery, public-chain authentication/finality, reproducible client builds and production readiness are not established. A reviewer still needs compatible, authorized tracing support and independently selected trusted tools.
