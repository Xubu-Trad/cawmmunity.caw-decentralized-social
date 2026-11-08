# Stake changes during custody callbacks

This bounded extension builds on the [account-transfer proposal](OWNER_CALLBACK_REVIEW.md). Its baseline already guards ownership transfer. `changeStake` is still unguarded there.

## Reproduction and proposed invariant

A callback-capable test token also owns synthetic account 2. It first deposits 100 units, then stores a valid 256-level zero-stake proof. During a second deposit or a withdrawal, its token callback increases that account's stake by one unit. Both baseline calls complete with an updated stake root and total stake inside the custody operation. Owner and epoch remain unchanged; liabilities and backing reconcile.

The proposed invariant is that a guarded custody operation cannot be interleaved with a stake-root mutation. The new variant adds **only `guarded` to `changeStake`**, on top of the previous transfer guard. In both scenarios it rejects the nested call with `REENTRY`, preserves the old root/stake, and allows the outer custody operation to finish. A subsequent standalone stake change succeeds with the same proof and updates the root and total stake.

This demonstrates authorized cross-function interleaving under an adversarial token/contract-owner fixture. It does **not** demonstrate theft, a real CAW token exploit, or unauthorized stake changes. Whether other atomic compositions should be allowed remains a design-review question; this candidate proposes serialization without adding administrative power.

## Verification

Four fresh local EVM scenarios pass: baseline and proposal across deposit and withdrawal. The unchanged call-level constructor/lifecycle harness also passes against the combined transfer/staking guarded variant. Tests deploy creation bytecode; no final code or storage is injected. Recorded Solidity 0.8.30, Node 20.20.2 and EthereumJS 10.1.3, Shanghai.

The first callback test exhausted its 10 million test-call gas allowance while storing the large proof payload. That failed lane remains preserved. The fixture-setup call was given 20 million gas and the test rerun; this is not a protocol gas-policy change. Disk, memory and elapsed-time guards remain unchanged. Existing installed locked dependencies were reused; no clean install is claimed.

```sh
cd experiments/c007-stake-callback
npm ci --ignore-scripts --no-audit --no-fund
node --max-old-space-size=256 run-callback.mjs /absolute/path/to/new-callback-output
node --max-old-space-size=256 run-lifecycle.mjs /absolute/path/to/new-lifecycle-output
```

## Exact scope and next work

The variant is retained separately. Original constructor code, the ownership-only proposal and frozen signed replay inputs remain unchanged. The existing 26-transaction/two-engine evidence does not cover this new bytecode. No full-suite, signed-transaction or second-engine replay was performed for this increment.

`settleFixedPool1` remains an unguarded state-changing entry point. Source review identifies it as the remaining cross-function review surface, but this increment has **not** reproduced a valid signed settlement inside a token callback. Its `balanceOf` calls use view/static execution, which alone does not establish safety against an incoming call from a token's mutable transfer callback. Do not label an unexecuted scenario as a confirmed failure. Reproduce that case before proposing a broader serialization change, then collect a new signed lifecycle before promoting the variant.
