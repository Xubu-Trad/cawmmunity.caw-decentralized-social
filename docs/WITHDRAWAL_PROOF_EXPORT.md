# Check a console withdrawal offline

The local console can save the signed transaction, receipt, two adjacent local block headers, and the proofs for the owner, custody credit and token balances on either side of a withdrawal. A reviewer can check the file with the console and node stopped. This release covers a regular wallet withdrawing mock tokens in a block containing one transaction.

## In the console

Open the saved withdrawal and choose **Verify saved action against history**, then **Download withdrawal proofs**. The download uses the evidence from that verification. Refreshing or changing the saved record requires another check. **Export saved receipt and rechecks** is still available for comparing what the browser recorded with what signed history shows. A discrepancy in the saved record remains visible.

## On a second installation

Use Node.js 20.20.2. Install the dependencies using the console's lockfile once. The verification command then needs only local files.

```sh
npm ci --prefix integration/local-console
node integration/local-console/verify-withdrawal-package.mjs withdrawal-proofs.json trusted-selection.json
```

Choose the selection separately. For your own run, record the expected transaction hash and amount, its block hash and the parent block hash from your selected local history, and the deployment's controller plus the addresses and runtime code hashes of the registry, posting, custody, token and wallet contracts. A reviewer who simply copies the selection out of the download accepts the exporter's choice of chain and contracts. [Example selection for the preserved fixture](../evidence/console-withdrawal-20261116/withdrawal-selection.json).

Exit 0 with `LOCAL_WITHDRAWAL_STATE_EFFECTS_VERIFIED` means the signature, inclusion, receipt and balance changes satisfy the existing reader for that selection. A different selected block or missing proof causes a nonzero exit. The checks establish consistency with the selected local headers. Public-chain finality, execution replay, mixed blocks and contract-wallet withdrawals require separate evidence.

## Repeat the controls

From a checkout of the research branch with the dependencies installed:

```sh
node integration/local-console/test-withdrawal-proof-package.mjs
node integration/local-console/test-transfer-proof-completeness.mjs evidence/console-transfer-receipt-20261115
```

The package controls use two previously published local withdrawal captures, including the fresh capture under the November 16 evidence directory. They cover matching and mismatched selections, altered evidence, incomplete proofs and malformed files. The transfer controls cover a separate review finding: a proven registry transfer requires ownership-transition evidence before the reader can classify a saved transaction as absent. [Prior acquisition](../evidence/console-withdrawal-20261116/README.md) · [R-07 review](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/pull/19#issuecomment-6918751018).

The read-only console endpoint and the Chromium download produced identical 28,866-byte files for the preserved withdrawal. The CLI verified two mock units using the fixture selection published before this change. The browser run used controlled responses. The separate endpoint run acquired proofs from a recorded local chain. No new transaction was submitted in either test. [Results and file hash](../evidence/withdrawal-proof-export-20261118/results.json).
