# Verify the console's safe ownership transfer

## Fixed mismatch

At baseline `2277a91a0af719cc9d579cadf40769c8e9cc809e`, the console prepares `safeTransferFrom(address,address,uint256)` but the mixed-block verifier accepts only `transferFrom(address,address,uint256)`. A freshly mined transaction using the console's exact prepared calldata reproduces the previous verifier's TRANSFER_CALLDATA rejection. This was a false rejection of a supported console action, not a false acceptance or loss of funds.

The verifier now accepts the exact three-argument safe-transfer calldata, directly from the owner EOA or wrapped by the selected fixture wallet. Existing direct transfers still work. Every safe-transfer recipient must have a verified empty runtime in the selected prior state; the fixture contract-wallet receiver is explicitly rejected because receiver callbacks are outside this experiment. Four-argument safe transfers, trailing calldata, wrong recipients and delegated signers remain unsupported. There is no general callback or arbitrary-contract-wallet support.

## Fresh evidence

The console prepared the transfer plan; its exact calldata was signed with the public disposable fixture account and mined with the new owner's post. The console then acquired and verified the actual Geth proofs through `/api/verified-posts`. Accepted block `0x984beaac7fa74b58d1aaf0adaa1f5c265e255eb0d855abf99b516f87758de81d` at `0xd` contains one transfer and one post, epoch2/nonce0. A repeat request returned identical verification output. Custody and token observations were unchanged across that block.

The same captured input rejected under the preserved pre-fix verifier and passed under the patched verifier. Second-engine replay results, complete capture and genesis are retained here. `second-engine.log` states the exact transaction/root counts. Six focused controls pass: proof-backed positive plus five semantic negative controls. Existing direct-owner16, HTTP acquisition15 and post-batch14 regressions pass. The negative semantic controls are not represented as newly signed/mined attacks.

The first local harness attempt inserted a declaration twice and stopped with SyntaxError before executing the transfer lane. Its complete failed output remains preserved separately; the corrected second run produced these results. No failed evidence was overwritten.

## Reproduction

Use the Linux/Node20.20.2 setup and locked dependencies described in `../owner-console-live-20261113/README.md`. From a checkout containing this fix:

```sh
node integration/local-console/test-safe-owner.mjs evidence/console-safe-transfer-20261113/owner-post-evidence.json
```

Expected6checks. For fresh execution, place the checkout as `src/` beside mine-safe-transfer.py and lane.mjs. Copy the preserved post-authority-sequence-before-safe.mjs into src/integration/local-console/ so the lane can reproduce the old rejection as well. Run `GETH_BIN=/absolute/path/to/verified/geth python3 mine-safe-transfer.py positive` with a new output directory. Existing binary hash, Node version, disk/memory and loopback guards remain intact. The portable GETH_BIN wrapper was not independently clean-machine tested. Replay the generated capture with the locked EthereumJS runner documented in `../post-batch-replay-20261113/README.md`.

## Boundaries

Same-operator local execution, not independent reproduction, browser-wallet interaction, public-chain finality or production readiness. The console plan was produced by its actual planning function and consumed by the real signing path; no claim of clicking through a browser is made. Fixture account2, selected code/controller and chain endpoints remain trusted inputs. The two oversized setup transactions remain outside the separate strict-reader resource boundary. No expansion of economic policy or real-asset support.

Next: independently reproduce this pinned ownership flow; extend lifecycle support only where the plan, execution and verification agree.
