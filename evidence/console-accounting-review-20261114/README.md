# expected accounting before the wallet request

baseline: `bf39c5215e425d50a4a54d7823f70e233be28a43`.

## what changed

the review panel now shows before/expected-after values for account credit, unpaid liability, custody balance, current-owner token balance and original-wallet token balance. the projection is calculated from the reviewed proof-backed snapshot after validating the exact action calldata using the existing plan verifier.

withdrawal reduces credit and liability and moves tokens from custody to the current owner. when that owner is the fixture wallet, owner and wallet display rows refer to the same balance, not two payments. an account handoff changes control of credit without moving the previous owner's tokens; the new recipient balance is not projected. the current unpaid post leaves mock-token accounting unchanged. local ETH gas is separate and is not estimated.

before requesting a wallet transaction, the console reacquires verified state and compares credit, liabilities and the three displayed balances with the reviewed snapshot. any change requires refreshing and reviewing again, even if the amount remains affordable. a newer block with unchanged accounting is allowed. existing owner, epoch, nonce, deployment and calldata checks remain in place.

the review is cleared on failure. an unsent journal intent is removed through the existing recovery path; no wallet request is made in the tested rejection cases. no extra fields were added to saved transaction records.

## evidence and limits

18 targeted checks passed: partial EOA withdrawal; a full withdrawal matching the retained executed state; fixture-wallet duplicate-row handling; post/transfer unchanged accounting; invalid calldata, excessive amount, missing verification and overflow rejection; changed accounting fields; coherent added credit; and a newer block with unchanged values.

14 headless Chromium checks passed against controlled snapshots from the previous fresh Geth run. they cover all three previews, changed credit blocking all three wallet requests, balance changes, new credit, missing proof status, unchanged accounting at a newer block, explicit wallet rejection cleanup and desktop layout. the wallet adapter deliberately rejects requests with code 4001. no real signature or transaction is submitted by this suite. 110 existing action-plan tests also passed.

the saved before/after snapshot is byte-identical to the preceding accounting-display evidence, not a new chain execution. this change adds no contract behavior or economics. the browser consumes the local verifier's proof result; it is not an independent cryptographic verifier. projections are specific to the selected research contracts.

this is a pre-request check, not an atomic guarantee. state can change while the wallet is open or before execution, and the contracts remain responsible for execution-time safety. there is no guarantee that mined balances will equal the preview. public-chain authentication, production asset support, actual wallet-extension testing and independent reproduction remain separate work.

## reproduce

use Node 20.20.2 and the local-console dependency lock. from the checkout:

```sh
node integration/local-console/test-accounting-review.mjs evidence/console-accounting-review-20261114/accounting-withdrawal.json
node --test integration/local-console/test-post-plan.mjs integration/local-console/test-account-transfer-plan.mjs integration/local-console/test-withdrawal-plan.mjs
```

expected: 18 targeted checks and 110 existing action-plan checks. for the browser test, create a fresh directory with the checkout in `src/` and this package's `accounting-withdrawal.json` at the directory root. set `CHROME_BIN` to a local Chromium executable, then run:

```sh
node --experimental-websocket integration/local-console/test-accounting-review-browser.mjs /absolute/path/to/fresh-directory
```

expected: 14 browser checks. the harness starts its own loopback HTTP server and browser and stops them afterwards. no real funds, wallet keys or signing are needed. use a new output directory for each run.

the earlier frozen ownership reproduction package stays unchanged. next retain the reviewed accounting context in pending-action recovery, so a reload cannot turn an expected change into an apparent confirmed result. specification decisions for paid posting remain explicit unresolved work.
