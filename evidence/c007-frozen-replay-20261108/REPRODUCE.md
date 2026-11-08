# Frozen synthetic replay package

This directory contains the four exact inputs pinned by `experiments/c007-transactions/compare-geth-transition.py`: **511,096 bytes** in total. The [manifest](manifest.json) records their hashes and sizes. This makes the retained fixture available without access to Xubu's local evidence directories. The original local and historical failed evidence lanes remain unchanged.

## What is included

- `acquired-history.json`: the original local synthetic capture, including signed transactions, headers and receipts. Its known original-header limitations remain evidence, not accepted public-chain claims.
- `genesis.json`: the selected three-account native funding allocation.
- `transaction-result.json`: the prior signed-transaction accounting result used for final native balance/nonce comparisons.
- `blocks.json`: the synthetic block sequence, serialized blocks and native proofs produced by the EthereumJS replay. Synthetic genesis fee and 25 changed timestamps are documented in `docs/LOCAL_BLOCK_REPLAY.md`.

No private keys or credentials are needed for replay. These are known synthetic local actors on chain ID 31337; do not fund or reuse them. Review checked source lineage, known genesis/receipt actors and visible plus hex-decoded strings for private paths and credential patterns. A pattern scan alone is not an exhaustive secret detector.

## Reproduce

Use a pinned checkout containing this directory, Python 3 and the publisher-verified Geth `evm` binary described in `docs/SECOND_ENGINE_TRANSITIONS.md`. Verify its SHA-256 and the archive's publisher signature before use. No wallet connection, running node, Anvil, EthereumJS installation or API credentials are needed for this Geth comparison.

From the repository root, in the recorded WSL environment:

```sh
python3 experiments/c007-transactions/compare-geth-transition.py evidence/c007-frozen-replay-20261108 evidence/c007-frozen-replay-20261108/blocks.json /absolute/path/to/verified/evm /absolute/path/to/new-result
```

The output directory must not exist. The runner currently checks its host disk floor at `/mnt/c`; native Linux portability is not claimed by this run. Minimums remain 2 GiB free host disk and 768 MiB available memory. It rejects Python optimized mode, mismatching binary/input digests, and oversized selected inputs. Do not regenerate files, change pins or disable guards to make a mismatch pass.

Expected: **26 transitions, 18 successes, eight expected reverts**, every intermediate state/transaction/receipt root matched, and four final native-account balances/nonces matched. Six negative controls distinguish comparison failures from execution rejection. Final root: `0xebc1e0dfefcf0625bbe28f9d17d937eaed9a24aa530edf84ed86bb1819127255`.

The recorded separate-directory test fetched the runner at commit `ecad6c83a0cb9a071bcf81b9c99495003f2a070d`, copied the package and verified binary, and used a fresh HOME/TMPDIR with a minimal environment. It passed without passing GitHub/API credentials into the replay process. This was the **same machine and operator**, without a network namespace or filesystem sandbox. It is not an independent operator's reproduction or proof of network isolation.

## Remaining review

Another builder should report the exact checkout, tool fingerprint/digest, input hashes, environment and result, including any mismatch. This remains execution agreement under supplied synthetic contexts, not consensus/header authenticity, original-Anvil repair, production readiness or an agreed protocol release. Public test-candidate and production gates remain closed.
