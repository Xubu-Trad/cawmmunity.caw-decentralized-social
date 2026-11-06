# Frozen reward checkpoint research

This is an offline arithmetic experiment extending the [reward capacity review](STAKING_BUDGET_REVIEW.md). It is **not** a live migration algorithm or an adopted protocol rule.

## Transformation

For each account in a frozen, valid model state, compute its pending scaled entitlement as credit + stake × index − debt. Store that result as its new credit and clear its debt. After processing every account, set the global index to zero. Keep the stake vector, funded total, paid total and unassigned remainder unchanged. Account claim fractions stay in the scaled credit; no value is redirected to a reset operator.

The [research helper](../experiments/paid-action/staking_checkpoint.py) copies the source state, processes at most 64 accounts per step and refuses final output until all accounts are processed. Cursor checks reject accidental duplicate or out-of-order steps. These checks are local bookkeeping, not cryptographic replay protection, authentication or authorization. The input is assumed to be a valid trusted model state, not untrusted network data.

Total processing and copied storage remain O(number of accounts). Batching does not make a whole-population conversion constant-time. A bounded step here is not measured EVM gas. The caller can pause the local calculation and resume it; that says nothing about live users posting, claiming or changing stake during a protocol transition.

## Evidence

[Six tests](../tests/test_staking_checkpoint.py) passed on Python3.12.14 under the existing resource guard. They cover entitlement/fraction/conservation agreement across batch sizes, 40 subsequent claim/stake/post operations matching an unnormalized reference, partial-output refusal and cursor bounds, detached source/output copies, a naive-reset negative control, and preservation of the separate lifetime-funded limit. [Result and source identities](../evidence/STAKING_CHECKPOINT_RESULTS.json).

The negative control clears index and debt without settling entitlements and demonstrably disagrees with the original pending rewards. The lifetime-funded limit test injects a counter boundary; it is not a reconstructed historical state. No Solidity, public chain, wallet, custody, signature or full Node suite ran.

```sh
python -I -B tests/test_staking_checkpoint.py
```

## What remains unsolved

This gives an accounting reference for evaluating future designs, not an automatic migration command. A live design still needs an authenticated state cut, preservation of concurrent rights, stale-intent rules, bounded per-user costs and safe continuation if any participant disappears. No privileged reset key is introduced here, but neither has a permissionless on-chain transition been implemented.

Index normalization does not reset the lifetime funded counter, remove the zero-increment condition or settle dust ownership. A design that requires every inactive account to cooperate, an administrator to attest a new root, or a prolonged global freeze would need to confront the operator-independence requirement explicitly. No such design is selected. Issue #5 and public-test/production gates remain open.
