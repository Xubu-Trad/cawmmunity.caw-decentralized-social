# Fresh console ownership-transfer verification

Source pinned to `6ac4978e526e32094cd4f2e70dcbd0ee9d5b838e`. A fresh isolated Geth1.17.10 chain mined an account2 transfer from the fixture wallet to its controller EOA, followed by the new owner's post in the same block. The running console's `/api/verified-posts` endpoint acquired the proofs directly from that Geth instance and returned HTTP200 / VERIFIED_LOCAL_HISTORY. A second complete request returned the identical result. No recorded-response proxy was used for this run.

Accepted block: `0x84a2d05f31a8195df27419eee2cee02a9edf680fec87d442e362e4c1eb36a897`, number `0xf`. The result contains one transfer and one post by the new owner at epoch2, posting nonce0; final nonce1. The ten recorded checks cover the response, endpoint/header identity, reconstructed ownership, post identity and repeatability. Observed custody credits/liability, token balances and allowance remained unchanged across the block.

The same complete chain capture was replayed with the existing locked EthereumJS10.1.3 engine: all13 signed transactions and15 post-genesis state roots matched, including gas, status and logs. Empty mined blocks are retained. The isolated Geth and console were stopped; existing user services were untouched. Eight proof-corruption and six semantic controls also rejected in the reused fixture lane.

## Reproduce

Use the exact source commit above, Linux, Node20.20.2, Python3 and the verified Geth binary hash `45335929e149413c9f680209c87fa14adc5750387da6f5f30b7b2bd24d2d54ea`. Install console dependencies with its committed lock (`npm ci --prefix integration/local-console --ignore-scripts`). Place that checkout as `src/` beside this package's `mine-console-owner.py` and `lane.mjs`, then run:

```sh
GETH_BIN=/absolute/path/to/verified/geth python3 mine-console-owner.py positive
```

Output `private/positive` must not already exist. This uses only the published disposable fixture signer and mock tokens. Existing resource guards and loopback-only node isolation remain enabled. The portable wrapper changes the local Geth path into GETH_BIN; that wrapper is supplied for reproduction but was not separately rerun on a clean machine. Output block hashes/timestamps may differ; require the checks to pass against the newly captured headers, not equality to this run's hash.

For replay, use the locked EthereumJS setup and replay.mjs documented in `../post-batch-replay-20261113/README.md`, passing this package's capture.json/genesis.json, or the newly generated ones. Retained-capture replay and fresh mining are different checks.

## Verification boundaries

This is fresh local execution and live console HTTP integration by the same operator, not independent reproduction, browser-wallet testing, public-chain authentication or consensus/finality. Account2, fixture code hashes/controller and selected endpoints remain explicit assumptions. The console does not perform complete EVM replay itself; the separate second-engine experiment supplies that comparison. The two oversized setup transactions remain outside the separate strict history reader's resource boundary. Full manifesto economics, arbitrary wallets and a production network remain unfinished.

## PR16 follow-up

At `60d5255314f982f77f9352075d046515ca36d0bc`, WD-27 incorporated the early receipt-envelope guard. We reran all26 submitted comparator regressions and four additional retained/independent string/array controls: each malformed response now returns structured FAIL with exit1 and the intended diagnostic, without traceback. ahdmesh independently reports R06 PASS_WITHIN_SCOPE. No fresh PR16 EVM experiment or Node checker rerun is claimed here. Raw/parsed response consistency and PR-wide acceptance remain separate; Issue2 is not closed by these results.

Next: independent pinned reproduction of the console path, followed by extending the supported owner lifecycle only with explicit tests and proof boundaries.
