# Bounded-integer reward model — 2026-11-02

IDEA — This model explores one fixed-point alternative to the [exact-rational comparison](STAKING_ACCUMULATOR_REVIEW.md). Its precision, caps and rounding are experimental choices, not accepted manifesto economics or a replacement for the current paid-action contract.

## Rule being tested

Use Q = 2^64 scaled units per token base unit. For fee F and eligible stake E (total stake excluding the payer account), increment the global reward index by floor(F*Q/E). Settle the payer at the old index and reset its debt at the new index so it earns none of its own fee. Settle accrued entitlement before changing a stake. A claim pays floor(entitlement/Q) and retains the fractional entitlement for that account.

Global rounding remainder F*Q - increment*E is separately accounted and never redistributed in this experiment. This is a different rule from both exact rational entitlement and the current probe's per-post recipient flooring. It must not be silently adopted. Account exclusion does not exclude a second account owned by the same person.

## Executed evidence

FACT — [The Python model](../experiments/paid-action/staking_fixed_model.py) matched a separate eager per-recipient implementation for four populations (3, 8, 64 and 256 accounts), each with 160 operations: 80 posts, 40 stake changes and 40 claims. After every operation, all scaled entitlements agreed and funded = paid + pending + unassigned. Payers earned no reward from their own posts. Maximum observed stored/entitlement width was 144 bits. These are deterministic finite sequences, not an exhaustive proof; both implementations use the same chosen rounding formula.

FACT — Five rejection cases preserved state: oversized scaled fee, oversized stake, no eligible stake, an increment rounded to zero, and index-cap exhaustion. The last uses an injected consistent zero-entitlement boundary state, not a historically reached state. A repeated claim paid zero while preserving the account fraction. An intentionally broken copy that discarded claim fractions failed with MODEL_DISAGREEMENT. [Saved result and hashes](../evidence/STAKING_FIXED_RESULTS.json).

Reproduce with Python 3.12.14, standard library only:

```sh
python -I -B experiments/paid-action/staking_fixed_model.py
```

For the negative control, copy the model to a new file and replace `self.credit[i]=remainder;` with `self.credit[i]=0;`, then run that copy. Preserve the original. The expected result is a nonzero exit and MODEL_DISAGREEMENT. Assertions must remain enabled (do not use Python -O).

## Bounds and unresolved limits

The model restricts per-account stake to 2^96-1, total stake to 2^128-1, and the index to floor((2^256-1)/(2^96-1)). The latter ensures stake*index fits an unsigned 256-bit word. Scaled fee and lifetime funded/paid counters are also checked against 2^256-1. Python arithmetic itself is unbounded; checks model selected uint256 boundaries, not compiled EVM arithmetic.

INFERENCE — Per-action lazy accounting avoids a recipient loop in the modeled update, but that alone proves neither acceptable gas nor a scalable protocol. Index/lifetime caps can eventually stop new posts, and tiny fees relative to stake can be rejected. There is no rollover design. Increasing precision moves these tradeoffs rather than removing them. Unassigned remainder has no withdrawal route; eventual disposition is unresolved.

The experiment starts with fixed account slots and valid caller-supplied indices. It does not implement registration, input/authentication boundaries, NFT transfers, custody, token transfers, withdrawals, reentrancy protection, signed actions, contract-wallet authority, stake snapshot timing or concurrent ordering. A model claim is bookkeeping, not an authorized on-chain payment. No Solidity contract ran and no gas was measured.

UNRESOLVED — Review the precision/error budget, dust ownership, exclusion rule and long-lived index strategy in [issue #5](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/issues/5) before selecting a candidate action profile. Then implement a bounded contract only with explicit rules and funding/withdrawal negative cases. No developer reset key is proposed.

The last full Node suite remains 1,251 tests across 73 files; it was not rerun for this standalone research script. Public-test deployment and production remain blocked.
