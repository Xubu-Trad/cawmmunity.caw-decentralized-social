# Portable registry verification pipeline

One runner now reproduces the complete bounded registry fixture verification using30 hash-pinned public files from `aa4907ed1d4c66b75612a994596e0a7cf67f29e0`. It uses no GitHub credentials, RPC endpoint, private workflow paths or deployment keys. A fresh snapshot run completed all six stages:

1. Recompile and execute the28 signed transactions in EthereumJS. Generated compiler input, operations and final result must be byte-identical to the retained fixture.
2. Independently reconstruct history and registry maps; output must match the pinned model. Eight altered histories reject.
3. Verify the explicitly selected registry manifest, compiled runtime/constructor and signed deployment.
4. Verify16 initialization storage fields with14 negative controls.
5. Verify16 later storage fields with16 negative controls against the regenerated model.
6. Replay all28 transactions in pinned Geth with seven rejection controls. Additionally require Geth roots at deployment and final withdrawal to equal the respective proof headers' state roots.

## Run without builder-specific paths

Use Linux, Python3, Node20.20.2, solc0.8.30, ethers6.16.0 and these EthereumJS packages at10.1.3: vm, tx, block, statemanager, common, util. Make their installed modules available to the repository's JavaScript modules in an isolated checkout. No automatic installation or network access is performed by the runner. The existing dependency tree was reused in the recorded run; this is not a fresh dependency-install or hermetic-build certification.

Obtain Geth evm1.17.10-stable-1df30b18 independently. The runner checks binary SHA-256 `d8cfddad15a8c601e7b069bc5973ad073dbc2d632b8c5ab50e513ef27c53d6da`. Verify the source checkout and choose the pin catalog digest explicitly. From repository root:

```sh
python3 integration/core-baseline-v1/verify-registry-pipeline.py --repo . --pins evidence/registry-pipeline-20261109/pipeline-pins.json --pins-sha256 5653f8dcf7f7bfb12d79d73120e552e37a48283bd3e4ee1395698b55ffabd647 --evm /path/to/evm --output /tmp/caw-registry-run
```

The output directory must be new and its parent must exist. The runner checks2GiB disk and1GiB available memory, caps Node heap at256MiB and gives each stage120 seconds. It retains stage logs and per-artifact provenance. It refuses Python -O, changed inputs, runtime version mismatch and wrong Geth bytes. The source catalog pins verification code as well as evidence.

## Authentication is a separate required result

Add `--require-authenticated-chain` to require chain authentication. **The current fixture deliberately exits2 after its local checks pass**, writes `LOCAL_PIPELINE_VERIFIED_CHAIN_GATE_OPEN`, and keeps chainAuthenticated/finalityVerified/productionAccepted false. This behavior was exercised in the recorded complete run. Exit0 without that flag means only local verification passed; it never means production acceptance.

The synthetic header roots agree with the retained execution states, but their headers are not a contiguous mined chain. No switch allows a user-supplied boolean to promote them into authenticated evidence. Existing source/proof/compiler dependencies may share mistakes; local repetition is not external audit.

See [authenticated acquisition requirements](REGISTRY_CHAIN_ACQUISITION.md) for the missing evidence. README updates remain paused.
