# Pinned console-history reproduction package

## Purpose and current result

Another builder should be able to run the same console-history checks without the original machine's node_modules, credentials, paths or live chain database. This package fixes a53-file input set at research commit `03a2da645eae94f32c5e6f33db21f9974117ca40`, stages only those files into a fresh output and installs the committed dependency lock into a new directory with an empty npm cache.

The clean-directory run here passed15 strict-reader negative controls,12 console integration checks,11 interruption/recovery checks and340 wallet/action checks. All53 selected files still matched after execution. Eighteen installed dependency versions matched the lock. Five runner controls confirmed valid selection and rejection of changed source, a changed manifest, symlinked source and reused output before process execution.

**This is a same-operator clean-directory reproduction, not an independent review.** It uses previously published signed synthetic history and proofs. It does not start Geth/Reth, generate a fresh chain, exercise a real browser/wallet, establish public-chain finality, reproduce process-crash persistence, or build Node from source. Those remain separate evidence requirements.

## Exact inputs

- Target source: `03a2da645eae94f32c5e6f33db21f9974117ca40`.
- Manifest SHA-256: `87a8fdb35a8662c3493dcace3f11a370281b41dbc543da0e2fd55e6ea45aad5e`.
- Manifest: `integration/local-console/console-reproduction-inputs.json`.
- Runner: `integration/local-console/reproduce-console-history.py` in the later checkout containing this guide. Record its commit separately from the target.
- Linux, Python3 standard library, Node20.20.2 and npm10.8.2. Python3.10.12 was observed here.
- At least2GiB free output space and1GiB available memory; when `/mnt/c` exists its free space is checked too. Required tools must already be installed. The runner does not delete old evidence or change the input checkout.

The runner validates a hard-coded manifest digest and exact source hashes before running code, rejects symlinked selected files, and rechecks copied inputs before installation and after tests. Existing source node_modules are never copied. npm uses an empty cache and explicit empty user/global config, with lifecycle scripts disabled; `NODE_OPTIONS`, `NODE_PATH` and inherited npm configuration are removed. Network access to registry.npmjs.org is needed for the locked install. Tests use disposable loopback HTTP servers.

A lockfile and integrity hashes fix package selection; they do not establish that dependencies are vulnerability-free. Node/npm and the reviewed runner/manifest remain trusted inputs. The recorded Node executable hash identifies this run, not independent binary provenance.

## One-command execution after selecting the target

From the research checkout containing this guide, create a separate pinned source checkout (choose a path that does not exist):

```sh
git worktree add --detach ../community-console-target 03a2da645eae94f32c5e6f33db21f9974117ca40
```

Then run the later runner against that pinned input. Select a new output whose parent exists; keep it outside the input checkout:

```sh
python3 integration/local-console/reproduce-console-history.py --source ../community-console-target --manifest integration/local-console/console-reproduction-inputs.json --output "$HOME/gilg/OUT/CONSOLE_REPRODUCTION_REVIEW_01"
```

No GitHub authentication, private workflow or original local database is needed by the runner. Do not change expected hashes or counts to make a failed run pass. Source changes require a new reviewed manifest, not an edit to this frozen target. Installation and each test command have bounded timeouts; timed-out process groups are stopped and failure evidence is retained.

The output includes `result.json`, per-step logs and `PROVENANCE.txt`. The result records input identity, runtime versions, the local Node executable hash, installed dependency versions/integrity references, exit codes and test counts. A PASS requires every command and the post-run source integrity check to pass. Preflight failures exit nonzero before creating output; preserve stderr as part of a reviewer receipt. Do not publish npm caches or private machine paths.

## Runner rejection controls

```sh
python3 integration/local-console/test-console-reproduction-runner.py integration/local-console/reproduce-console-history.py ../community-console-target integration/local-console/console-reproduction-inputs.json "$HOME/gilg/OUT/CONSOLE_RUNNER_CONTROLS_01"
```

These controls create separate altered-input copies and retain them. They mock process launch to ensure rejected inputs cannot start npm or tests. They do not constitute a general audit of the runner.

## Independent reviewer receipt

Record the target commit, runner commit and hash, manifest hash, OS/runtime versions, literal commands, exit codes and result/log hashes. State which checks actually ran and which remain NOT RUN. Identify whether the operator and environment are independent without publishing personal machine details. Compare semantic results and selections, not elapsed-time-dependent full-log hashes across machines.

An external PASS for this package would establish independent reproduction of these bounded recorded-history and HTTP-recovery tests. It would not establish fresh-chain execution, browser verification, public consensus, production safety or complete manifesto compliance. No such external PASS is currently claimed.

[Clean-run result](../evidence/console-reproduction-20261113/result.json) · [Runner controls](../evidence/console-reproduction-20261113/runner-controls.json) · [Interruption boundaries](CONSOLE_VERIFICATION_RECOVERY.md) · [Setup guide](REPRODUCTION_SETUP.md)
