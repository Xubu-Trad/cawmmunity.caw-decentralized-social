# C-007 — Executed unfunded-emitter negative control

EXECUTED_LOCAL_UNFUNDED_NEGATIVE_CONTROL. Parent `b9df3b349b7fa2e364a0603c6aa54b793443c2f7`, draft PR19. This tests the limitation highlighted by [synthetic event projection](C007_POSITIVE_EVENT_PROJECTION.md) using actual local EVM execution. It changes no frozen baseline contract or accepted economics.

## Experiment

A fresh EthereumJS VM uses disposable native funds and a publicly known test key, with no network connection or broadcasting. Three signed transactions deploy a mock token, deploy a deliberately unfunded emitter, and call emitWithoutPayment. The token gives the test caller100 units at construction. The emitter knows the token address but never calls its transfer function or debits a protocol account.

The emitter computes a consistent research record ID, emits ResearchFeeAdmitted with fee5 and emits ResearchFeeClaimed with amount4. Its logs pass the candidate layout and record-consistency checks. They are still not validated economic transitions.

FACT — All three local transactions succeeded. The mock token's balanceOf reports payer100 and emitter0 both before and after the emitting transaction. No mock-token fee moved. Native gas expenditure is separate and does not satisfy the token-fee claim. The selected fixture runtime hash and signed operations are retained in the evidence.

This is an intentionally dishonest fixture, NOT a vulnerability report against the frozen candidate, actual CAW token or any deployed project. It demonstrates why execution and well-formed events alone cannot establish backing or CAW authority. The local execution flag is true only for this single VM experiment; feeBackingVerified and cawActionAuthorityVerified stay false. There is no production admission gate being certified here.

## Harness correction and evidence limits

The first run stopped when direct balance-query calls altered the caller nonce in the VM harness. That failed run is preserved locally. The corrected run wraps each query in a state-manager checkpoint/revert and asserts both the state root and sender nonce are unchanged. No contract behavior, transaction nonce checks or VM validation was weakened.

The run compiles with solc0.8.30 (optimizer200, Shanghai), uses Node20.20.2, ethers6.16.0 and EthereumJS10.1.3 packages. This is a single-engine transaction execution, not independently reproduced EVM state, an assembled canonical block, actual token proof, a full receipt/body reconstruction or a chain deployment. The deliberately unfunded emitter is not production code.

## Reproduce

With the existing package versions listed in [toolchain.json](../evidence/unfunded-emitter-20261108/toolchain.json):

`node --max-old-space-size=256 integration/core-baseline-v1/test-unfunded-emitter.mjs integration/core-baseline-v1/UnfundedEmitterResearch.sol /absolute/path/to/new-output evidence/admission-binding-20261108/vectors.json`

The output directory must not exist. [Compiler input](../evidence/unfunded-emitter-20261108/compiler-input.json), [signed local operations](../evidence/unfunded-emitter-20261108/operations.json) and [result](../evidence/unfunded-emitter-20261108/result.json) are finite synthetic-asset evidence. The key in the harness is a public disposable fixture key; never fund it or broadcast these operations.

## Required funded-admission boundary

An actual candidate must prove the exact authorized payer/account debit, correct asset and amount, successful atomic custody/accounting transition, and backing/claim liabilities against reviewed state semantics. Token balance responses alone also depend on verified token behavior; existing malicious-token and original-asset proof gates remain relevant. Do not infer these properties from matching event fields or a successful receipt.

Next compare an explicitly funded mock-token admission transition with failure cases that leave no fee record or spendable credit. Keep that experiment separate from C-007 adoption, NFT identity and production registration. README updates remain paused; hosted CI remains deferred.
