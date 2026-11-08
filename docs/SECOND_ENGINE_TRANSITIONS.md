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


## Verified publisher and frozen-input follow-up

The archive signature has now been verified with GnuPG against Linux-builder primary fingerprint `FDE5A1A044FA13D2F7ADA019A61A13569BA28146`, selected from the official HTTPS download page. The signed archive has the previously recorded SHA-256, and its extracted `evm` bytes match the already-used local binary. A one-byte archive mutation fails signature verification. This establishes a signature under the selected publisher key; it is not a source rebuild or independent certification of publisher identity. The earlier unverified acquisition record remains historical evidence. See [signature result](../evidence/c007-geth-selection-20261108/signature.json).

The comparison runner now pins SHA-256 digests for the four exact inputs: acquired history, funding genesis, prior transaction summary and serialized synthetic block package. Each JSON input is read once with an 8 MiB bound; the same bytes are hashed and parsed. A valid selection therefore cannot silently substitute a changed file between hashing and parsing. This does not defend against a malicious local process replacing the executable after its hash check.

Python optimized mode is explicitly refused before argument processing because this research harness relies on assertions. Eight focused checks pass: unchanged fixture acceptance, four changed-file rejections, truncation rejection, oversized-input rejection and optimized-mode rejection. The complete 26-transition comparison still passes through the new input gate. Its existing six controls remain passing. No full repository suite was rerun.

### Reproducibility limitation

This version intentionally accepts only the frozen V4 inputs named by those digests. A fresh capture with different timestamps or serialized metadata is rejected and needs a separately reviewed fixture selection; the harness does not automatically trust a newly generated manifest. **The complete frozen inputs are currently local, so the public repository alone does not yet allow another builder to reproduce this retained result.** Generating a similar capture is not an exact replay of this evidence. The earlier reproduction command applies once the matching frozen files are available.

The next concrete gate is a reviewed, minimal, self-contained synthetic input package with all four matching hashes, plus reproduction from a clean location. Tool signature verification and file integrity do not authenticate a chain, genesis choice, consensus, finality or provider. The application remains a draft research candidate.

Focused input checks, with the same frozen files:

```sh
python3 experiments/c007-transactions/check-geth-selection.py experiments/c007-transactions/compare-geth-transition.py /absolute/path/to/inputs /absolute/path/to/blocks.json /absolute/path/to/new-check-output
```
