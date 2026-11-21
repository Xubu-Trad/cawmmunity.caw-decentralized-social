# C-007 — Funded fixture replay with a second engine

The exact15 signed operations from the funded mock admission experiment agree between EthereumJS10.1.3 and Geth evm1.17.10. Every intermediate state root, gas charge, receipt status and log matched. The signed transaction bytes were unchanged. This strengthens local execution evidence; it does not adopt the experiment's economics or establish production readiness.

## Result and limits

Final queried mock balances remain payer1, contract10 and other wallet89. Allowance90, protocol nonce2, liability10 and two record budgets5 are unchanged. The complete state root, including native account accounting, matches at every step; no second set of Geth ABI getter calls is claimed.

The repeated synthetic context uses block number1, timestamp1, base fee1 and zero coinbase. These are fifteen sequential state transitions under supplied contexts, not fifteen valid blocks or an authenticated public chain. No header/consensus validation, independent external audit, actual CAW compatibility, NFT beneficiary, claims or withdrawal implementation is established. C-007 remains unresolved; the fee5 and fixed payer are research inputs.

## Portable Geth check

Use Linux, Python3 with assertions enabled, and the exact Geth evm binary selected by SHA256 `d8cfddad15a8c601e7b069bc5973ad073dbc2d632b8c5ab50e513ef27c53d6da`. This runner does not download or install software. Its binary pin identifies the retained tool; it does not independently authenticate the publisher. Review the earlier tool provenance before acquiring it independently.

```sh
python3 integration/core-baseline-v1/replay-funded-geth.py   evidence/funded-geth-20261108/fixture.json /absolute/path/to/evm /new/output/directory
```

The runner requires2GiB free on the output filesystem and, under WSL, C:, plus1GiB available memory. It refuses an existing output directory. Each subprocess has a30second timeout and Geth receives a256MiB memory target. The selected input is bounded to2MiB and pinned by digest before parsing results or starting Geth. No RPC or wallet service is used.

Five comparison mutations reject altered state root, gas, status, logs and signed bytes. Two actual engine controls reject a wrong chain ID and a spent sender nonce. Separate startup checks confirmed a changed fixture and optimized Python stop before an output directory is created. These are finite negative cases, not exhaustive fuzzing.

## Reproduce the EthereumJS observations

The added `test-funded-admission-roots.mjs` differs from the existing funded harness only by recording the state root after each operation. Use the same solc0.8.30, ethers6.16.0 and EthereumJS10.1.3 dependencies as the original experiment:

```sh
node --max-old-space-size=256 integration/core-baseline-v1/test-funded-admission-roots.mjs   integration/core-baseline-v1/FundedAdmissionResearch.sol /new/execution/directory   evidence/admission-binding-20261108/vectors.json
```

The resulting operations, with `stateRoot` removed, must equal the original funded operations; compiler input and final queried report must also equal the original files. The packaged fixture retains those roots plus the explicit allocation and context. Both engines use locally constructed test data and the comparison is authored by the same project, not an independent reviewer.

Evidence: [fixture](../evidence/funded-geth-20261108/fixture.json), [replay result](../evidence/funded-geth-20261108/result.json), [startup controls](../evidence/funded-geth-20261108/selection-controls.json). No frozen protocol contract or README changes are included. Hosted CI remains deferred.
