# Pinned console ownership reproduction

## What this adds

One launcher now checks the selected source files, installs locked console dependencies into an empty directory/cache, starts a disposable local Geth node, prepares and signs the console's safe-transfer operation with the published fixture key, mines the transfer and new-owner post, acquires their proofs through the console HTTP endpoint, reruns the focused negative controls, and checks that the selected inputs remain unchanged. It saves results, logs, exit codes and hashes. It never uses real assets or an existing node database.

The source selection contains64 files pinned to `e0fa16d3a6f10cc9a88dfde0d130598273005f06`. Manifest SHA256: `192922b2ecae732f7d25a29a08d6f795b62658237f3aa0d5f44f5164854a18c4`. The source closure was checked against Git blob identities at that commit. This launcher is an additional file in the later commit containing this guide; record that commit too.

## Run

Use Linux/WSL, Python3, Node20.20.2 and npm, with at least1GiB available memory and2GiB free disk. Obtain the Geth1.17.10 binary whose SHA256 is `45335929e149413c9f680209c87fa14adc5750387da6f5f30b7b2bd24d2d54ea`. The launcher checks that hash; it does not download a binary or prove its source build. Review the runner and code before execution. Network access is needed for npm dependencies; their lock remains unchanged and install scripts are disabled.

From a checkout containing the launcher and the unchanged pinned64-file input set:

```sh
python3 integration/local-console/reproduce-console-ownership.py   --source "$PWD"   --geth /absolute/path/to/verified/geth   --output /absolute/path/to/new-ownership-run
```

The output's parent must exist, output must be outside the source directory and must not already exist. Run again with a new output path. The manifest defaults to the adjacent ownership-reproduction-inputs.json. An updated checkout is acceptable only if all selected files still match that manifest; branch names alone are not sufficient provenance.

Expected result.json status PASS,10 console checks and6 safe-transfer checks; all three steps must exit0. A fresh npm cache and node_modules are created in the output. The runner retains the isolated node database, proof capture and failed output for diagnosis; it stops only its own node. Existing local services are not stopped. Block hashes/timestamps may differ between runs.

To exercise pre-execution rejection controls separately:

```sh
python3 integration/local-console/test-ownership-reproduction.py   integration/local-console/reproduce-console-ownership.py   "$PWD" integration/local-console/ownership-reproduction-inputs.json   /absolute/path/to/new-control-results
```

The control test copies the selected checkout for mutation tests, so allow additional disk space. Expected7checks. It prohibits child-process launch while testing invalid input rejection.

## Result and limits

The November14 same-operator fresh-directory run passed with new dependency installation,10 live console checks and6 safe-transfer controls. All64 pinned inputs remained unchanged. Seven launcher controls passed: valid selection, changed verifier, changed manifest, symlinked selected file, existing output preservation, output inside source, wrong Geth binary. Source and manifest changes reject before executing test nodes.

This is a reproducible experimental local ownership flow, not a public network installer or independent reviewer confirmation. No browser wallet was exercised, no second-engine replay was rerun in this package, and no public-chain consensus/finality is established. Earlier two-engine evidence remains separately pinned. Fixture account2/controller/code selections remain explicit. Full CAW registration/economics and production release gates remain open; two oversized setup transactions remain outside the separate strict history reader's limit.

Please report the launcher commit, manifest hash, Node/npm/Geth versions, exact command, result.json, steps.json, PROVENANCE.txt and any failed logs. Review logs before sharing. Never include personal keys or unrelated files. A failure is evidence to retain, not a reason to lower verification checks.
