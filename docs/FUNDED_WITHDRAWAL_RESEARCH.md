# Experimental funded-credit withdrawal fixture

The [integration plan](FUNDED_CREDIT_WITHDRAWAL_PLAN.md) is now implemented as a separate fixed-owner research fixture. It is not an NFT registry, adopted C-007 interpretation or production contract. Original frozen contracts and prior experiments are unchanged.

## Implemented boundary

Three recipient accounts have constructor-selected owners. Only a current owner can transfer its account or withdraw its credits; both operations require the current epoch. Transfer increments the epoch and preserves account credits and pending rewards. This account-bound entitlement is the explicitly disclosed experimental hypothesis. There is no developer setter, escape key, arbitrary withdrawal recipient or delegated withdrawal signature.

One guard covers admission, claim, account transfer and withdrawal. The invariant is `unpaidLiability = unallocatedBudget + creditedLiability`, with credited liability equal to the three account credits. Vault custody must cover total unpaid liability. Claims move budget to credit without reducing total liability. Withdrawal reduces only available credit and liability, checks exact vault decrease and caller balance increase, and reverts the whole transaction if token behavior disagrees. Snapshot weights are not withdrawable staked principal; staking integration is absent.

The mock token has unrestricted failure/callback controls for tests only. Never use it as a production token. The source retains the original compiler key and contract names; the separate source filename preserves earlier fixtures.

## Executed sequence

61 signed local EthereumJS transactions passed their expected outcomes. Two mock fee5 admissions fund10. Account2 claims1, transfers A to B, then claims another1. B withdraws2 at the current epoch while8 unallocated reward units remain backed. Transfer back to A increases the epoch again; the old A epoch does not become valid. Account3 claims and withdraws8, with zero-value account4 claims marked once.

Final mock balances are payer9, other wallet91 and vault0, totaling100. Credits, record budgets, unallocated budget, credited liability and unpaid liability are all0. Account2's epoch is2; the other epochs remain0.

The six admission and eight claim rejection cases are retained. Fourteen withdrawal/transfer negatives cover former owner, new-owner stale epoch, excess amount, zero amount, another account, unknown account, non-owner transfer, zero new owner, token false-after-mutation, token revert, short recipient credit, excess vault debit, exhausted credit and A-to-B-to-A stale epoch. Each tested failure preserves queried token/accounting/ownership state and has no logs; gas and outer transaction nonce still change.

During successful withdrawals the token attempts callbacks into all four mutable entry points. Each returns the exact `REENTRY` reason; the outer withdrawal still completes and reconciles balances. The claim callback uses ABI-valid empty proof arrays to show that the lock runs before proof checks; it does not demonstrate an otherwise valid repeated claim. Callback coverage here is during outbound token transfer, not every possible external call or future token.

V1 stopped when setting the mock token's callback to a full proof payload; the expected-success setup transaction reverted. Its output is preserved. V2 uses compact ABI-valid callback data while retaining the5million transaction gas limit. No contract guard or expected rejection was removed. The retained V1 log does not identify a decoded revert reason; do not call it a demonstrated protocol defect or claim a conclusively diagnosed out-of-gas cause.

## Reproduce

Use the existing Node20.20.2, ethers6.16.0, solc0.8.30 and EthereumJS10.1.3 dependencies:

```sh
node --max-old-space-size=256 integration/core-baseline-v1/test-funded-withdrawal.mjs   integration/core-baseline-v1/FundedWithdrawalResearch.sol /new/execution/directory   evidence/funded-claims-20261108/vectors.json evidence/funded-claims-20261108/proofs.json
```

The local wrapper enforced2GiB free disk,1GiB available memory and a120second timeout. No network service, real wallet or live deployment was used. [Saved result](../evidence/funded-withdrawal-20261108/result.json), signed operations and compiler input are retained with provenance.

## Limits and next step

This is one-engine local evidence. The prior29-operation two-engine comparison does not cover this new contract or sequence. Constructor ownership is not ERC-721 integration; snapshot authority, original CAW compatibility, C-007 allocation policy and production readiness remain unresolved. The source's claim comment means no token transfer occurs during claim; the shared invariant guard does call the token's view balance function.

Next reconstruct the61-operation ownership/epoch/credit/withdrawal history using the existing readers, then compare exact execution in the second engine. README updates remain paused and hosted CI deferred. Do not fund this research fixture.
