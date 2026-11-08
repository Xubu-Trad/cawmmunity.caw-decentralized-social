# Second execution-engine comparison

Geth's `evm t8n` tool independently executed the same 26 signed transactions used by the [synthetic block replay](LOCAL_BLOCK_REPLAY.md), starting from the same explicit three-account funding allocation. Each next prestate comes exclusively from Geth's previous output. No final state, contract bytecode or storage is injected from EthereumJS.

## Observed agreement

- All **26 intermediate state roots** match EthereumJS 10.1.3.
- All transaction roots, receipt roots, gas totals and blooms match. The output transaction bodies preserve the original signed bytes.
- Outcomes remain **18 successes and eight expected reverts**.
- All four final native-account balances and nonces match the preceding accounting result.
- Final state root: `0xebc1e0dfefcf0625bbe28f9d17d937eaed9a24aa530edf84ed86bb1819127255`.

Four comparison controls reject changed expected state/transaction/receipt roots and gas totals. These test the comparison assertions, not four Geth consensus rejections. Two execution controls separately show Geth rejecting a wrong chain ID and a spent nonce. The successful 26-transition run supplies the positive control. No new full repository suite was run.

## Exact boundary

This is agreement between two execution implementations for this finite fixture. `t8n` receives explicit Shanghai block conditions; it does **not** validate a linked chain of headers or beacon consensus. Its root agreement does not authenticate input provenance, finality, randomness or an RPC provider. The fixture retains the synthetic genesis and 25 timestamp changes documented in the preceding experiment. It does not repair the original Anvil chain or turn its rejected storage proofs into accepted proofs.

The Geth allocation output supplies the next prestate, while EthereumJS roots serve only as comparisons. State-root agreement covers the resulting committed state under the selected execution conditions; it is not a general correctness proof, an external audit or production acceptance.

## Tool provenance and reproduction

The tool reports `evm version 1.17.10-stable-1df30b18`. It was obtained over HTTPS from the [official download listing](https://geth.ethereum.org/downloads), with its listed MD5 matching the archive. MD5 here checks download consistency, not publisher authentication. The PGP signature was **not verified**, and the binary was not rebuilt from source. These supply-chain limits remain explicit.

Binary SHA-256: `d8cfddad15a8c601e7b069bc5973ad073dbc2d632b8c5ab50e513ef27c53d6da`.

Archive SHA-256: `f991c32e5b7bb68db97a1b06d50c7c06f6aa9ae84d8f6f9b2301dc02cad2a7cf`.

The adapter follows the [pinned upstream transition-tool format](https://github.com/ethereum/go-ethereum/blob/v1.17.10/cmd/evm/README.md). It submits RLP lists of already-signed legacy transactions, Shanghai rules, chain 31337, empty withdrawals and disabled mining rewards. It never supplies private keys. The binary digest is pinned in the harness.

```sh
python3 experiments/c007-transactions/compare-geth-transition.py   /absolute/path/to/synthetic-replay-inputs   /absolute/path/to/synthetic-replay/execution/blocks.json   /absolute/path/to/evm   /absolute/path/to/new-output
```

The inputs are the existing `acquired-history.json`, `genesis.json` and `transaction-result.json`. Generate `blocks.json` with the prior replay harness. The output directory must not exist. This recorded runner checks the Windows-host disk floor through `/mnt/c`; use the documented WSL environment. Minimum startup resources remain 2 GiB host disk and 768 MiB available memory, with a 512 MiB process RSS limit and 180-second run limit. Geth is given `GOMEMLIMIT=256MiB` and `GOMAXPROCS=2`.

Only code, acquisition metadata and the bounded result summary are published here. Detailed per-transition allocations, logs and signed bodies remain in the local preserved lane. See [summary](../evidence/c007-geth-transitions-20261108/result.json).

## Next gate

Independently authenticate the execution-tool artifact and tighten the input/genesis/header selection boundary. Then test acquisition and replay without relying on Xubu's machine or selected endpoint. Real NFT/token admission, open-population economics and release review remain unresolved. PR #19 remains draft and stacked on #18.
