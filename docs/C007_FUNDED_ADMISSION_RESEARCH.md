# C-007 — Fixed-payer mock funded admission

LOCAL_MOCK_FUNDED_ADMISSION_ONLY. Parent `2da2f0a5e0510fef0d8fe8836f93e11d4595be14`, draft PR19. Companion to the [unfunded emitter control](C007_UNFUNDED_EMITTER_CONTROL.md). This is a separate experimental contract, not a change to the frozen core or adopted CAW economics.

## Tested transition

One constructor-selected payer can submit the next research nonce. A successful admission requires transferFrom to return true, a payer-token decrease of exactly5 mock base units, and a contract-token increase of exactly5. Only then does it advance the nonce, record a budget5 for the research record ID, add5 to unclaimedLiability and emit the candidate admission event. Recorded token balance must cover that liability. There is no setter for payer, token or the constructor snapshot.

The payer is one fixed experimental account, not an administrator over other users. This fixture is NOT permissionless NFT admission. Epoch0, total stake10, payer stake2, profile and fee5 are explicit test assumptions. The constructor root is supplied by the harness; membership and canonicality are not established. It uses direct caller authority, not delegated sessions or the frozen EIP-712 posting flow.

## Executed evidence

Fifteen signed operations run in a fresh local EthereumJS VM using disposable native funds. Two admissions succeed, each transferring5 mock tokens and producing a matching event/record budget. Six admission cases fail with their specific expected revert reason:

| Case | Expected reason |
| --- | --- |
| No allowance | ALLOWANCE |
| Allowance4 for fee5 | ALLOWANCE |
| Repeated admission nonce | NONCE |
| Token mutates balances/allowance, then returns false | TOKEN_FALSE |
| A different caller | PAYER |
| Payer balance1 for fee5 | FUNDS |

Each failed admission emits no logs and leaves the checked token balances, allowance, protocol nonce, liability and next-record budget unchanged. Native transaction gas and sender transaction nonce still advance normally; this is not a claim that the entire EVM state is unchanged after a failed transaction.

The false-return token case is particularly relevant: its internal balance/allowance mutations roll back when the admission reverts. No accounting record survives a rejected payment. Each successful record retains budget5, total liability is10, contract token balance is10 and next nonce is2. After a separate intentional token transfer used to create the insufficient-balance case, payer balance is1 and the other wallet holds89: 1+10+89=100 initial mock units. There is no spendable claim credit or withdrawal implementation in this fixture.

## Mock and harness limitations

The mock token's unrestricted failure-mode switch is test instrumentation and is deliberately unsuitable for production. Exact balance checks depend on token behavior; a dishonest token can lie consistently, as prior research already records. This test does not authenticate the actual CAW token or close its proof gate.

The initial run failed compilation on a declaration syntax error and is retained. A corrected run passed; a third retained run additionally checked exact revert reasons rather than accepting any failure. Balance queries use checkpoint/revert and verify unchanged state roots, preserving the earlier nonce-contamination lesson.

This is a single-engine local execution, not a canonical block, independent external reproduction, receipt/body replay or production audit. No real funds or network deployment were used. Do not deposit assets into this fixture: it intentionally has no withdrawal path.

## Reproduce

Use the same existing solc0.8.30/Node20.20.2/ethers6.16.0/EthereumJS10.1.3 versions recorded for the preceding control:

`node --max-old-space-size=256 integration/core-baseline-v1/test-funded-admission.mjs integration/core-baseline-v1/FundedAdmissionResearch.sol /absolute/path/to/new-output evidence/admission-binding-20261108/vectors.json`

[Compiler input](../evidence/funded-admission-20261108/compiler-input.json), [signed operations](../evidence/funded-admission-20261108/operations.json) and [result](../evidence/funded-admission-20261108/result.json) preserve the successful run. Output must be new. Publicly known test keys are local fixtures only; never fund or broadcast them.

NEXT — Reconstruct these actual mock admission budgets/nonces from the executed observations and compare with queried state, preserving the distinction between an execution log and authenticated chain history. Claims, withdrawal rights, transfer semantics, independent execution, real-token proof and C-007 agreement remain gates. README updates remain paused; CI remains deferred.
