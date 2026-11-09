# C-007 — Reconstruction of funded account credits

The separate reader reconstructs all29 signed operations in the [funded claim experiment](C007_FUNDED_CLAIMS_RESEARCH.md). It derives balances and credits from signed calldata and checked event fields, comparing them to the final queried EVM report only after reconstruction. No contract state is used to calculate claim amounts.

## What is checked

Pinned compiler input is recompiled and both signed deployment bytecodes/constructor arguments must match. Transaction byte hashes, chain ID, recovered signatures and per-sender nonces are checked using the existing sender reader with ethers supplying the signing digest. The token admission accounting checks are retained.

Claims bind their record to the deployment address, chain, profile, nonce and constructor snapshot. The reader validates the supplied payer and recipient SHA-256 sum proofs, computes the candidate allocation and compares the decoded event's emitter, record, account and amount. It tracks claim markers, including zero-value claims, remaining budgets and account credits. It checks after every operation that remaining budgets plus credits equal unpaid liability and that token custody covers that liability.

Eight claim rejections are reconstructed: unknown record, payer, incorrect total from altered weight, altered recipient root, altered payer root, short proof and two repeated claims. Failed observations must have status0 and no logs. The model does not reconstruct native gas fees or EVM revert data.

## Result

All29 observations match. Account2/3/4 credits are2/8/0; both record budgets are0; unpaid liability10 remains backed by10 mock tokens. Payer and other-wallet token balances are1 and89. Protocol nonce2 and allowance90 match the queried result. Six claim markers include both zero-value claims.

Thirteen mutated histories reject: seven earlier admission/hash mutations and six claim mutations (missing operation, duplicate signed operation, altered amount, redirected account, replaced record and missing event). A separate Python ticket-enumeration oracle rebuilds the fixed snapshot and confirms all six allocations without using the Solidity prefix-floor expression. Four oracle mutations reject changed amount/account and missing/duplicate claims.

These checks are authored by the same project. Different language and arithmetic provide additional checks, not independent external peer review.

## Reproduce

With the retained ethers6.16.0 and solc0.8.30 dependencies:

```sh
node --max-old-space-size=256 integration/core-baseline-v1/reconstruct-funded-claims.mjs   evidence/funded-claims-20261108 evidence/funded-claim-reconstruction-20261108/input-pins.json
python3 integration/core-baseline-v1/check-funded-claim-oracle.py   evidence/funded-claim-reconstruction-20261108/result.json evidence/funded-claims-20261108/proofs.json
```

The first command emits reconstructed JSON; compare it with the saved [result](../evidence/funded-claim-reconstruction-20261108/result.json). The second checks the selected saved result against independently enumerated fixed-snapshot allocations. [Oracle output](../evidence/funded-claim-reconstruction-20261108/oracle.json) is retained. No EVM or network service starts in these reconstruction commands.

## Boundaries and next gate

The observations are hash-pinned local transaction/log records, not authenticated receipts or canonical public history. Signature recovery does not establish the legitimacy of the constructor snapshot or adopted economics. No withdrawal beneficiary, NFT ownership, actual CAW compatibility or general arbitrary-fee arithmetic is established. README remains unchanged and hosted CI deferred.

Next replay this exact29-operation claim contract in the second engine before expanding custody or withdrawal behavior. The previous15-operation admission comparison does not cover the new claims.
