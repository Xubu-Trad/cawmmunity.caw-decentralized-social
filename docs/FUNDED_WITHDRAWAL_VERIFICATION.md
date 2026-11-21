# Experimental withdrawal history and second-engine verification

The [withdrawal fixture](FUNDED_WITHDRAWAL_RESEARCH.md) now has both a separate accounting reconstruction and an exact61-operation EthereumJS/Geth comparison. These are bounded synthetic results, not production acceptance.

## History reconstruction

The existing signature and event readers are reused. The model verifies transaction hashes, recovered senders, chain ID, sender nonces, rebuilt deployment bytes and constructor arguments. From signed calldata it tracks token settings, balances, allowances, ownership and epochs. It verifies admitted records and claim proofs, reconstructs budgets/credits and checks transfer/withdrawal events against the signed action rather than trusting event labels alone.

Current-owner and epoch checks reject stale authority, including A-to-B-to-A. The model recognizes the four token-failure modes and requires reverted observations with no logs. At each transition it checks conservation and that unclaimed budgets plus remaining credits equal unpaid liability covered by custody. Failed observations do not reduce debt or award credit.

All61 observations match the queried final state: payer9, other wallet91, vault0, all account credits and both budgets0, unpaid liability0, allowance90, protocol nonce2 and ownership epochs2/0/0. Six claim markers remain. Nineteen altered histories reject, including missing transfer, changed epoch, redirected or changed withdrawal, missing event and falsely successful unauthorized withdrawal.

The model counts configured callbacks during successful withdrawals under an explicit shared-lock assumption. It does not independently execute nested calls or reconstruct native gas fees. The separate engine comparison below supplies actual execution comparison; no external audit is implied.

## Exact second-engine comparison

Fresh EthereumJS observations differ from the retained61 signed operations only by added state roots; compiler input and final queried report are identical. Geth executes those same signed bytes with the same initial native allocation and supplied contexts. All61 intermediate state roots, gas charges, receipt statuses and logs match, including token-failure rollback and callback instrumentation state. Final state root: `0xea166946a6149296a17b3befc25b7c27ddf8ee3cba7a723bff3af4244b8ab3e1`.

Five mutated-result comparisons reject changed root, gas, status, logs and signed bytes. Geth rejects wrong-chain and spent-nonce transactions. Altered fixture bytes and optimized Python reject before replay. This does not exhaust adversarial token behavior.

## Reproduce

With the retained Node20.20.2, ethers6.16.0 and solc0.8.30 dependencies:

```sh
node --max-old-space-size=256 integration/core-baseline-v1/reconstruct-funded-withdrawal.mjs   evidence/funded-withdrawal-20261108 evidence/withdrawal-reconstruction-20261108/input-pins.json
```

For Linux/Python3, use the retained Geth evm binary with SHA256 `d8cfddad15a8c601e7b069bc5973ad073dbc2d632b8c5ab50e513ef27c53d6da`:

```sh
python3 integration/core-baseline-v1/replay-withdrawal-geth.py   evidence/withdrawal-geth-20261108/fixture.json /absolute/path/to/evm /new/output/directory
```

The runner pins and bounds the fixture, refuses existing output, requires2GiB free destination/WSL-host disk and1GiB available memory, and uses30second engine timeouts. It performs no download or RPC. Binary equality is checked; publisher authentication is not rerun.

Regenerate the first engine's roots with EthereumJS10.1.3 and the same Node/compiler dependencies:

```sh
node --max-old-space-size=256 integration/core-baseline-v1/test-funded-withdrawal-roots.mjs   integration/core-baseline-v1/FundedWithdrawalResearch.sol /new/execution/directory   evidence/funded-claims-20261108/vectors.json evidence/funded-claims-20261108/proofs.json
```

The root-recording harness changes only observation output. See [reconstruction](../evidence/withdrawal-reconstruction-20261108/result.json), [replay](../evidence/withdrawal-geth-20261108/result.json) and [startup controls](../evidence/withdrawal-geth-20261108/selection-controls.json).

## Remaining boundary

All engines use repeated synthetic contexts rather than a validated public chain. Constructor owners are not an ERC-721 registry. The fixed root, allocation and account-bound pending entitlements remain experimental assumptions. No original-token proof, live consensus, independent external review or production readiness is established. Do not fund the fixture. Frozen code and README remain unchanged; hosted CI stays deferred.

The next integration step should address the real registry authority boundary using the existing account-authority work, rather than adding more variants to this same synthetic sequence. Review constructor owner maps versus authoritative NFT ownership/transfer hooks, epoch invalidation, approved operators and callback ordering before selecting the bounded adapter. No production registration/burn decision is resolved by this result.
