# Contract-wallet ownership and funded withdrawal

## Core lifecycle increment

The core roadmap's NFT ownership/custody journey now has a separate direct contract-wallet-owner fixture. The existing registry and custody logic is unchanged; the research source appends an immutable-controller wallet that accepts ERC721 safe transfers and executes calls only for its controller. It has no developer override or mutable controller. This is test instrumentation, not a production wallet recommendation.

Twenty-one signed local EthereumJS transactions passed their expected outcomes. Two experimental fees of five fund ten mock units; account2 claims two units. Its NFT moves to the contract wallet at epoch1. The controller calls through the wallet to withdraw one unit to the wallet itself. The wallet then transfers the NFT to the other account, advancing epoch2. That new owner withdraws the remaining unit; the old wallet no longer has authority.

Six rejected cases preserve the checked custody/token/registry snapshot and emit no logs: controller calling custody directly; outsider executing the wallet; stale wallet epoch; false-returning token after mutation; former-wallet withdrawal after transfer; new owner using the old epoch. Gas and sender transaction nonces still change on reverted transactions and are outside the rollback claim.

Final mock balances: payer90, wallet1, new owner1, custody8, totaling100. Account2 credit0; credited liability0; unallocated budget8 and total unpaid liability8. The remaining eight units stay backed in custody. Historical claims move with the account in this experimental entitlement model; C-007 remains unresolved.

## Reproduction and scope

Use the existing pinned research toolchain (Node20.20.2, solc0.8.30, ethers6.16.0, EthereumJS10.1.3), the original admission-binding imports and the preserved funded-claim vectors/proofs:

```text
node --max-old-space-size=256 integration/core-baseline-v1/test-wallet-owner-withdrawal.mjs integration/core-baseline-v1/WalletOwnerWithdrawalResearch.sol NEW_OUTPUT evidence/funded-claims-20261108/vectors.json evidence/funded-claims-20261108/proofs.json
```

The local launcher retained the2GiB disk/1GiB available-memory gates and120-second deadline. No network service, live wallet or real funds were used. Public disposable keys3/4 are synthetic test inputs; never fund them. Signed operations and compiler input remain preserved locally with published hashes; the harness regenerates them.

This proves the bounded direct-execution wallet fixture, not arbitrary contract wallets, ERC1271 signatures, ERC4337 account abstraction, public registration, real CAW compatibility or an adopted economic policy. It does not prove independent reconstruction, a second engine, canonical chain evidence or production safety. No original frozen contract, recovery package or specification decision was changed.

Next: reconstruct this21-operation wallet/registry/custody history and compare the exact signed bytes with the second execution engine. The earlier28-operation registry and persistence evidence cannot be counted as verification of this new lifecycle. Independent persistence reproduction remains separately pending.
