# Signed local binding refund-cap comparison

FACT — an owned Anvil1.8.1 London node captured a signed legacy call to seeded runtime `0x6000600055600060015500`. It clears slots zero and one, each initialized to7. This is a separately defined two-slot experiment, not a one-variable comparison with the previous one-slot fixture. Runtime and initial storage were synthetic setup; no deployment or public-chain evidence is claimed.

Four grouped cases passed on pinned EthereumJS10.1.3:

1. Both verified child storage values are zero. Execution consumes10012 gas plus21000 intrinsic gas. The refund counter is9600, exceeding the London cap floor(31012/5)=6202. Applying6202 yields24810 net gas, matching the captured receipt and all three account balances/nonces. Receipt status, logs, bloom and cumulative gas match too.
2. Incorrect sender nonce is rejected.
3. Insufficient sender balance is rejected.
4. Removing only slot one's selection and proof rejects execution with WITNESS_STATE_MISSING_SLOT. Instrumentation confirms one completed storage write before failure, as well as four account writes. Health fails and retry/discard cannot restore usability. Failed internal balances/storage are intentionally unreadable, so no post-failure state inspection is claimed.

Input signature/body/header/account/code/storage commitments, child proofs and the captured receipt root verify before comparisons. The refund counter is engine-observed; acquired net gas and balances independently agree with the cap calculation. Negative nonce/balance cases modify an overlay and are not alternate authenticated state.

After frozen dependency installation, from `experiments/execution-engine`:

```text
node --max-old-space-size=256 signed-cap-replay.mjs ../..
```

Fresh acquisition from repository root, using a new empty directory:

```text
python -B experiments/signed-cap-fixture/acquire.py --anvil PATH_TO_PINNED_ANVIL --output NEW_DIRECTORY/capture.json
python -B experiments/signed-cap-fixture/project.py NEW_DIRECTORY/capture.json NEW_DIRECTORY/fixture.json
```

Keep existing evidence intact. The projection excludes raw request/runtime logs. No impersonation or public RPC was used; public test identities must never receive real assets. [Result hashes](../evidence/ENGINE_CAP_RESULTS.json) pin tested files. Guards/dependencies unchanged; four scoped cases passed. The unchanged1241-test ordinary suite was not rerun or inflated.

UNRESOLVED — full post-state-root reconstruction, general transaction/fork/refund coverage, account creation/absence, contract-wallet authority and production acceptance. Next consolidate the bounded adapters into a reviewed shared implementation with explicit rejection of unsupported state operations, retaining every acquired fixture and regression boundary. Do not claim these synthetic cases certify CAW contracts.
