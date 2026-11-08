# Synthetic local block construction and replay

This follow-up to [signed transaction execution](INDEPENDENT_TRANSACTION_LIFECYCLE.md) builds 26 local Shanghai blocks and replays their serialized bytes in a fresh VM initialized from the same explicit allocation. Both producer and consumer use EthereumJS 10.1.3. This is same-library reproducibility, not independent-client agreement or consensus authentication.

## Observed results

All 26 transaction roots, receipt roots, gas totals and receipt blooms match the captured transactions. Fresh block replay reproduces every generated state root. The final root matches the previous signed-transaction experiment, and four native-account balance/nonce proofs agree with its final accounting. The original contract-storage checks remain evidence from that preceding experiment; this harness does not rerun those 20 field checks.

An unmodified reconstructed block passes. Seven separately initialized negative controls reject a wrong parent, nonincreasing timestamp, wrong base fee, wrong state root, wrong receipt root, missing transaction and wrong gas used. Block execution uses `runBlock` with validation enabled and `generate:false`.

## Deliberately different genesis and headers

The original capture cannot be called a valid replay of this synthetic chain. Two failed experiments are retained locally:

- V1: its selected empty genesis implies a next-block base fee of 875,000,000 wei, while the capture starts at 1,000,000,000 wei.
- V2: the captured timestamps repeat across blocks and fail the strictly increasing timestamp check.

The successful fixture explicitly sets a **synthetic genesis base fee of 1,142,857,142 wei**, whose normal empty-block fee progression reaches the captured first fee. Genesis contains only three synthetic funded accounts; it does not reconstruct Anvil predeploys. Each new timestamp is `max(captured timestamp, parent timestamp + 1)`, changing 25 of 26 timestamps. Transaction bytes remain unchanged. These changes did not alter the checked outcomes, receipts or final state for this transaction set. That observation does not generalize to other time-dependent transactions.

The local header policy checks parent, height, increasing time, fixed gas limit, fee progression, zero difficulty/nonce and extra-data length. Withdrawals are empty. A custom local header validator replaces the default blockchain header-validation hook; there is no beacon signature, randomness authentication, fork-choice or finality proof. Neither original Anvil state roots nor its included-zero storage proofs are repaired by this experiment.

## Reproduction

Use the existing locked dependencies in `experiments/c007-transactions`. Prepare the same `acquired-history.json` and `genesis.json` inputs described in the transaction experiment, plus its successful summary named `transaction-result.json`.

```sh
cd experiments/c007-transactions
npm ci --ignore-scripts --no-audit --no-fund
node --max-old-space-size=256 build-replay-blocks.mjs /absolute/path/to/inputs /absolute/path/to/new-output
```

The output directory must not exist. It receives the summary and serialized synthetic blocks with native proofs. The public package contains the harness and [summary](../evidence/c007-block-replay-20261108/result.json); detailed block data remains in the preserved local evidence lane. Recorded Node 20.20.2; bounded run at 256 MiB heap, 512 MiB RSS and 180 seconds. No full-suite or production-deployment result is claimed.

## Remaining gate

A second execution client must agree on a precisely specified genesis and block sequence before independent-client agreement can be claimed. Source/header authentication remains a separate gate. This draft remains stacked on PR #18; it does not resolve NFT admission, real-token compatibility, open-population economics or release acceptance.
