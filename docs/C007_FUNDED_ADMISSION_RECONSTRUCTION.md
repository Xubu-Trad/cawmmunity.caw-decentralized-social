# C-007 — Reconstruction of executed mock admissions

RECONSTRUCTED_LOCAL_MOCK_ADMISSIONS. Parent `bb56da6e5ccc0e68c8a70f13fff2873d89146b66`, draft PR19. A separate accounting model checks the [funded mock admission experiment](C007_FUNDED_ADMISSION_RESEARCH.md). No frozen protocol contract, parameter or README is changed.

## Reconstruction inputs and checks

The checker pins the saved compiler input, signed-operation observations and queried final-state report. It rebuilds the compiler output, matches both deployment transaction bytecodes and constructor arguments, derives deployment addresses and recovers transaction senders. Keccak(raw transaction) must equal the saved hash. The existing signature reader checks the ECDSA equation over the transaction signing digest; ethers supplies parsing/signing-digest construction, so this is not a fully independent transaction decoder.

Per-sender transaction nonces advance across successful and reverted observations. Direct token approvals/transfers and the mock's failure-mode changes are reconstructed from signed calldata. Admission checks reproduce caller, protocol nonce, payer funds, allowance and false-return conditions before accepting a successful observation. Successful admission events must match the constructor snapshot, experimental constants and computed record commitment. Failed admissions must have no logs and satisfy the model's rejection conditions.

The separate model tracks mock-token balances, allowances, protocol nonce, unclaimed liability and per-record budgets. It checks supply conservation and liability backing after each operation. It does not reuse the executed contract's storage values to derive these quantities; the saved queried state is compared at the end.

## Result

All15 operations reconstructed. Final values matched the queried local VM:

| Value | Reconstructed and queried |
| --- | ---: |
| Payer mock-token balance | 1 |
| Contract mock-token balance | 10 |
| Other wallet mock-token balance | 89 |
| Remaining allowance | 90 |
| Protocol next nonce | 2 |
| Unclaimed liability | 10 |
| Each successful record budget | 5 |
| Next record budget | 0 |

The six modeled rejection reasons are ALLOWANCE, ALLOWANCE, NONCE, TOKEN_FALSE, PAYER and FUNDS, agreeing with the earlier harness's exact revert checks. Seven mutations reject: duplicate operation, missing admission operation, false success for a failed payment, log on a reverted payment, missing successful admission event, wrong emitter and changed transaction-hash label.

## Reproduce

With existing solc0.8.30 and ethers6.16.0:

`node --max-old-space-size=256 integration/core-baseline-v1/reconstruct-funded-admission.mjs evidence/funded-admission-20261108 evidence/funded-reconstruction-20261108/input-pins.json`

[Input pins](../evidence/funded-reconstruction-20261108/input-pins.json) and [result with per-operation trace](../evidence/funded-reconstruction-20261108/result.json) retain the check. No EVM or network service is started by this reconstruction command.

## Scope

This is a same-author accounting model over hash-pinned local observations, not a second EVM, independent external audit or complete canonical-history acquisition. Receipt statuses/logs come from the saved VM observation file: no receipt/header proof is added in this step. Hash pins establish which observations were checked, not that they occurred on a public chain. Native gas accounting is intentionally separate and not reconstructed here.

The fixed payer, fee5, root and mock token remain experimental assumptions. No registration, NFT ownership, claims, withdrawals, actual-token compatibility or C-007 agreement is established. Next obtain independent execution/state comparison for this exact fixture before expanding its scope. Keep the earlier failed evidence and original frozen baseline intact. README updates remain paused; hosted CI remains deferred.


## Subsequent execution comparison

[Second-engine comparison](C007_FUNDED_GETH_COMPARISON.md) now reproduces all15 exact signed operations and intermediate states. The earlier model boundaries remain as recorded; the new result does not add chain authentication or production acceptance.
