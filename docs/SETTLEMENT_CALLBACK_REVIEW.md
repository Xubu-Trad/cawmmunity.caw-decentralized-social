# Signed settlement during custody callbacks

The remaining unguarded settlement entry point now has a concrete local reproduction. Starting with the transfer/staking-guarded variant, the harness funds and stakes all three accounts, constructs a valid owner-signed application intent, and supplies that intent to an instrumented mock token. During account 2's deposit or withdrawal, the token submits the intent to `settleFixedPool1`.

## Observed result and bounded proposal

Both baseline callbacks successfully settle the signed action: nonce increments and fee allocations occur before the outer custody operation returns. Owner, epoch and stake root remain unchanged; credits and token backing reconcile. This is authorized settlement under an adversarial callback-capable token, **not demonstrated theft, forged authorization or a real CAW token exploit**.

The separate proposal adds the existing `guarded` modifier to settlement. Together with the earlier transfer/staking guards, all five state-changing vault entry points now use the same lock: deposit, withdrawal, ownership transfer, stake change and settlement. Read-only functions remain callable. The intended invariant is serialization of these mutations during external custody calls; this remains a proposal whose composition tradeoffs require review.

With the new guard, nested settlement rejects with `REENTRY`; the outer custody call completes without consuming the signed intent. The same intent settles successfully afterward, and replay then rejects with `NONCE`. This checks lock release and intent usability rather than merely observing a revert.

## Evidence

- Four fresh local EVM settlement scenarios compare baseline/proposal across deposit and withdrawal.
- The combined variant also passes the previous four ownership and four staking callback scenarios, using their original baselines.
- The unchanged constructor/lifecycle call harness passes against the combined variant.

These are **12 comparative callback scenarios**, not 12 distinct vulnerability classes. The combined source SHA-256 is `e4149f2ddb09e5f83c999e20dc14180f8f7c254584f401e2249bead0c2e45cfa`. Tests execute creation bytecode and calls with valid application signatures; they do not submit signed Ethereum transactions. No full repository suite, independent-engine replay or fresh dependency install is claimed. One ownership wrapper run encountered the previously identified process-exit sampling race; its failed lane is preserved and the corrected wrapper rerun passed without weakening limits.

The mock token is instrumented at compilation time to store/submit a callback payload. Vault code is not otherwise changed. Compiler input/output is retained locally for each scenario. Solidity 0.8.30, Node 20.20.2, EthereumJS 10.1.3, Shanghai; existing runtime resource guards remain in effect.

## Reproduce

```sh
cd experiments/c007-settlement-callback
npm ci --ignore-scripts --no-audit --no-fund
node --max-old-space-size=256 run-callback.mjs /absolute/path/to/new-callback-output
node --max-old-space-size=256 run-lifecycle.mjs /absolute/path/to/new-lifecycle-output
```

For combined ownership/staking regressions, copy the respective earlier experiment directory to a new directory and replace only its `DeployedCustodyStakeResearch.sol` with this combined source; retain each earlier `Baseline.sol` and callback harness unchanged. Run its existing `run-callback.mjs` with a fresh output path. Do not overwrite retained experiment directories.

## Next gate

Keep this variant separate until a new signed local lifecycle and independent reconstruction/execution validate its changed bytecode. The original constructor candidate, original Anvil failures, earlier proposals and public frozen fixture remain unchanged. Their existing 26-transaction two-engine evidence does **not** certify this variant. Callback suppression does not establish malicious-token compatibility, full re-entry safety, NFT/wallet admission, adopted economics or production readiness.
