# Signed local-chain lifecycle

The constructor candidate from PR #19 now runs through signed transactions on a loopback-only Anvil chain. The Solidity source is unchanged: SHA-256 `508fcadf4cab9b66771e74ad90a57d0bbd89d2a0e3977c89f8e0169780d540cb`. This extends the [constructor/call experiment](CONSTRUCTOR_LIFECYCLE_RESEARCH.md).

## Observed result

26 transactions were submitted with `eth_sendRawTransaction`: 18 succeeded and eight reverted as expected. Both constructor failures are mined transactions. The two read-only digest calls remain calls, not transactions. The same vault receives approvals/deposits, stake changes, the signed paid post, recipient transfer and reward withdrawals. Replay, unauthorized/stale-epoch withdrawals and a stale post after transfer-away/return reject. Tested rejection state snapshots remain unchanged for vault accounting; sender native balances/nonces naturally change when paying for mined failures.

For each transaction the harness retains signed raw bytes, the fetched transaction and receipt. It recomputes Keccak of the signed bytes, recovers and checks the sender using ethers, checks the chain ID, compares fetched calldata and receipt transaction hash, and checks expected status. The existing lifecycle assertions check fee debit, floor allocations, dust/backing, nonce, exact event text and token withdrawals. Error reasons are observed separately through a pre-submission `eth_call`; receipts themselves contain status/logs, not revert strings.

[Recorded inputs and results](../evidence/c007-signed-constructor-20261108) include the synthetic genesis, compiled source/output, transaction bytes and receipts. Initial native balances fund known synthetic keys 1/2/3 through genesis. No contract runtime/storage, token balances, account credits or stake roots are injected. Token test minting uses the mock API.

## Reproduce

Use Anvil 1.5.1, Linux binary SHA-256 `1eaa28361b8ef92f80a0eaf4f1d90e42744e07e79a3bee5e5de95e178c8aeedf`. The recorded runtime was Node20.20.2, solc0.8.30, ethers6.16.0 and EthereumJS dependencies10.1.3. The updated package lock records ethers; clean-install reproduction was not performed. The record reused installed dependencies. The run was capped at180seconds, combined512MiB RSS,256MiB Node heap and10MiB process logs after disk/memory preflight. The owned local service was stopped afterward.

```sh
# Terminal 1, from the repository root. Use only these synthetic keys/accounts.
anvil --host 127.0.0.1 --port 18545 --chain-id 31337 --hardfork shanghai --init evidence/c007-signed-constructor-20261108/genesis.json --silent
# Terminal 2
cd experiments/c007-constructor
npm ci --ignore-scripts
node --max-old-space-size=256 run-signed-lifecycle.mjs /absolute/path/to/new-output-directory http://127.0.0.1:18545
# Stop the local Anvil process when done. Never use the test keys on a public chain.
```

## Remaining gates

This is one locally operated chain. The signing library also performs sender recovery; this is not an independent implementation comparison. Block-body/receipt-root verification and independent history reconstruction through the existing community readers are next. No claim is made about public inclusion, finality, provider independence, clean-machine reproducibility or a full regression run.

Three synthetic accounts, the unrestricted mock token, fixed-pool arithmetic and provisional text policy remain. NFT registration, original CAW compatibility, open-population economics, wallet compatibility and production review are unfinished. No new policy or developer authority is introduced. The validity window in this run spans the local chain's advancing blocks; narrow-window boundary evidence remains in PR #18.


## Reader follow-up

The fresh [signed history reconstruction](SIGNED_HISTORY_RECONSTRUCTION.md) now checks complete transaction/receipt roots and independently recovers senders for blocks1–26. The original capture above is unchanged. Final-state replay, independent acquisition and authenticated endpoints remain open.
