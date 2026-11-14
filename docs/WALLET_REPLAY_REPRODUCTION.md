# Reproduce the synthetic wallet transitions

This package permits Geth replay of the exact 29-transaction wallet fixture and comparison with the recorded EthereumJS result. It contains synthetic signed transactions from disposable local test accounts, not production funds or credentials. The wallet's application validation is still a configurable test mechanism. This is not an audited wallet, a public testnet deployment or consensus validation.

## Inputs and tool

Use the exact PR commit containing this document. From its checkout root, the four inputs are in `evidence/c007-wallet-replay-20261108/`; their SHA-256 digests and sizes are in manifest.json and independently pinned in the comparison script. No Node installation, compiler, RPC connection or account credentials are required for this Geth comparison. Python3 standard library and Linux amd64 Geth evm1.17.10 are required. Python optimized mode is rejected because the checks use assertions.

The pinned tool is the `evm` member of [Geth alltools1.17.10](https://gethstore.blob.core.windows.net/builds/geth-alltools-linux-amd64-1.17.10-1df30b18.tar.gz). Verify the archive SHA-256 `f991c32e5b7bb68db97a1b06d50c7c06f6aa9ae84d8f6f9b2301dc02cad2a7cf` against acquisition provenance before extraction; the exact recorded archive hash is supplied below from the local verification record. Verify the downloaded archive's detached `.asc` signature with the Linux builder key identified on the official Geth downloads page. The recorded primary fingerprint is `FDE5A1A044FA13D2F7ADA019A61A13569BA28146`. Only extract the `evm` executable from the archive. Its required SHA-256 is `d8cfddad15a8c601e7b069bc5973ad073dbc2d632b8c5ab50e513ef27c53d6da`; the runner checks it before execution. This pin identifies the previously verified binary, not a source rebuild.

## Run from the checkout root

```sh
python3 experiments/c007-contract-wallet/check-replay-inputs.py   experiments/c007-contract-wallet/compare-geth-transition.py   evidence/c007-wallet-replay-20261108   evidence/c007-wallet-replay-20261108/blocks.json   /absolute/path/to/new-input-check-output

python3 experiments/c007-contract-wallet/compare-geth-transition.py   evidence/c007-wallet-replay-20261108   evidence/c007-wallet-replay-20261108/blocks.json   /absolute/path/to/evm   /absolute/path/to/new-transition-output
```

Output directories must not exist. The runner requires2GiB free disk,768MiB available memory, and applies bounded execution time/RSS/output limits. WSL also checks its Windows host drive. Do not bypass those limits or input digests to obtain a pass.

Expected:29transitions,23successes,6reverts; every intermediate state root, transaction root and receipt root matches. Final root is `0x43a1daedd9fd6d3209e537a0f1c81048c4ca49050c855d85d427f457d5d29c7e`. Six comparison/execution controls and eight input-integrity checks pass. Results are written to summary.json and result.json respectively.

## Boundaries

The package uses synthetic genesis funding and constructed block contexts:28timestamps were adjusted to be strictly increasing and the synthetic genesis base fee is1142857142. The captured Anvil chain is preserved, but its state-root mismatch is not repaired or authenticated. Geth t8n does not validate full headers or consensus here. This package reproduces a second-engine comparison, not a fresh compiler build or a real wallet signer scheme. Private keys used for synthetic funding must never hold real assets.

The source scan flagged `e:/` inside captured block5's 32-byte state-root hash. That exact inspected hash was excluded from binary-text scanning; no general scanner rule was disabled. A pattern scan is not exhaustive disclosure review.
