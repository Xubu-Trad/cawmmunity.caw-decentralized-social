# C-007 — Second-engine replay of funded claims

The new funded-claim contract's exact29 signed operations now agree between EthereumJS10.1.3 and pinned Geth evm1.17.10. Every intermediate state root, gas charge, receipt status and log matches. This is separate evidence for the claim implementation; the earlier15-operation admission experiment remains unchanged.

The fresh EthereumJS run adds only state-root recording to the existing harness. Removing those added fields reproduces the saved operations exactly; compiler input and final queried report also match. Geth receives those exact signed bytes from the same initial native allocation and executes them sequentially. The final state root is `0xd5e7702c5159c3867a8acdc96ad27a2f6fb0030c895a5e9f39179598b09014d2`.

Final account credits remain2/8/0, both record budgets0, total unpaid liability10 and mock-token vault balance10. The complete state-root comparison includes native accounting, but this step does not perform separate Geth ABI getter queries.

## Reproduce

Use Linux and Python3 with assertions enabled, with the retained Geth binary SHA256 `d8cfddad15a8c601e7b069bc5973ad073dbc2d632b8c5ab50e513ef27c53d6da`. No download or network service is performed by the runner. The pin identifies a specific binary; publisher authentication is not repeated by this command.

```sh
python3 integration/core-baseline-v1/replay-claims-geth.py   evidence/claims-geth-20261108/fixture.json /absolute/path/to/evm /new/output/directory
```

The runner refuses an existing output directory, altered fixture digest and optimized Python. Input reads are bounded to2MiB. Resource checks require2GiB free on the destination filesystem and WSL host drive, plus1GiB available memory. Each engine process has a30second timeout and256MiB memory target.

To regenerate the EthereumJS roots with the existing Node20.20.2, ethers6.16.0, solc0.8.30 and EthereumJS10.1.3 dependencies:

```sh
node --max-old-space-size=256 integration/core-baseline-v1/test-funded-claims-roots.mjs   integration/core-baseline-v1/FundedClaimResearch.sol /new/execution/directory   evidence/funded-claims-20261108/vectors.json evidence/funded-claims-20261108/proofs.json
```

Compare the generated operations with the fixture's operations array. The only change from the earlier claim harness is recording each post-transaction state root; state-restoring getter checks remain enabled.

## Controls and limits

Five comparison mutations reject altered state root, gas, status, logs and signed bytes. Actual Geth controls reject the wrong chain ID and a spent sender nonce. Two separate startup controls reject changed fixture bytes and disabled Python assertions before replay starts. [Results](../evidence/claims-geth-20261108/result.json) and [startup checks](../evidence/claims-geth-20261108/selection-controls.json) are retained with the [fixture](../evidence/claims-geth-20261108/fixture.json).

The repeated block context is synthetic, not an assembled valid chain. No header/consensus authentication, external independent review, real CAW compatibility or production acceptance is established. The constructor stake root and order-sensitive allocation remain experimental assumptions. No NFT withdrawal beneficiary or adopted C-007 rule is introduced. The frozen protocol and README remain unchanged; hosted CI remains deferred.

Next review the existing ownership/withdrawal decision boundary before connecting account credits to any transfer of tokens. Crediting an account does not establish who may withdraw, whether entitlement follows an NFT transfer or what signed authorization must bind. Do not add a developer escape key or silently choose those policies.


## Ownership integration review

[The next integration plan](FUNDED_CREDIT_WITHDRAWAL_PLAN.md) identifies the outstanding-budget accounting boundary and an explicitly experimental account-bound withdrawal sequence. No new withdrawal behavior or policy adoption is claimed.
