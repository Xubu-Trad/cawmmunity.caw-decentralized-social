# fresh local post through console history verification

baseline: `5db9a699b8b66eaa93623730ec4a37fb793829fd`.

## result

a fresh isolated Geth database was initialized from the preserved synthetic genesis, bootstrap transactions were replayed, and the separate research posting contract was deployed. headless Chromium then prepared, reviewed and submitted one signed wallet-wrapped post through the actual console. the disposable EIP-1193 adapter signs only the explicitly approved fixture transaction; this is not a real wallet-extension compatibility test.

the receipt was recovered after reload. the console's new history button acquired and verified the freshly mined post's signed transaction, receipt commitments and ownership proofs. a second reload verified the saved post without reconnecting the wallet or submitting again. refresh invalidated a deliberately delayed real verification response; an explicit retry succeeded with the same transaction. the interruption is controlled response delivery after verification, not a node crash or an interruption inside the proof reader.

13 browser journey checks passed. the exported record was also checked offline against newly captured headers, bodies, receipts and state proofs, returning `INCLUDED_POST_MATCHES_LOCAL_RECORD`. the transaction hash is `0x5a2c7b20f4ff504c4ab4c3b83bd2fccd31fcc38ed7afd523426d537873dddb8d`; deterministic fixture inputs reproduce transaction bytes, so the hash alone is not evidence of a fresh run. the new block hash, fresh database, execution log and capture record the run. only one browser-submitted post was sent; bootstrap replay and posting deployment are additional launcher transactions.

the post nonce advanced from zero to one. credited mock tokens stayed at two and custody's token balance stayed at ten. posting remains unpaid research behavior, not completed manifesto economics. all launcher-owned services stopped. the selected local headers are not public-chain finality, and this is not an independent operator reproduction or a new second-engine replay.

## reproduce the execution

use Linux, Node 20.20.2, the local-console lockfile, Chromium and the pinned Geth binary from the existing reproduction setup. this run verified Geth SHA-256 `45335929e149413c9f680209c87fa14adc5750387da6f5f30b7b2bd24d2d54ea`. set `CHROME_BIN` to your reviewed Chromium executable. retain at least 2 GiB free on both the backing host filesystem and the output filesystem, and 1 GiB available memory. the existing launcher disk/memory guards remain unchanged.

```sh
python3 integration/local-console/launch.py --geth /absolute/path/to/reviewed/geth --capture evidence/wallet-headers-20261112/capture.json --genesis evidence/wallet-headers-20261112/genesis.json --selection evidence/wallet-state-20261112/selection.json --registry-proof evidence/wallet-headers-20261112/evidence.json --output /absolute/path/to/new-run --receipt-history
```

the new `--receipt-history` mode runs the fresh browser journey, captures the resulting history, runs the offline binding checker and stops its services. it cannot be combined with `--smoke`. use a fresh output directory; do not overwrite failures. existing dependency installations were reused in this run, so this does not demonstrate installing every tool from a clean machine.

to check the published capture without launching a node:

```sh
node integration/local-console/check-receipt-history.mjs evidence/console-fresh-receipt-20261115/post-export.json evidence/console-fresh-receipt-20261115/review-state.json evidence/console-fresh-receipt-20261115/capture.json evidence/console-fresh-receipt-20261115/selection.json
```

## preserved failures and limits

the initial V1 fresh run submitted the post and displayed successful verification, but the harness failed to record the response because its observer was installed after the page captured fetch. that run remains incomplete, with its raw failure logs retained locally. V2 moved observation to page startup and reran in a separate fresh database. no protocol verifier, acceptance condition or test guard was weakened to obtain success.

host startup was previously blocked by low disk space and then by unavailable approval-review credits; no launch occurred at that rejected attempt. old diagnostic traces and rebuildable browser code-cache files were removed under existing cleanup authorization, and the user freed additional space. no project evidence or preservation checkpoint was removed.

the mission and frozen reproduction package are unchanged. independent reproduction remains pending. next extend strict receipt binding to account ownership transfers, keeping withdrawal accounting and public-chain acceptance separate.
