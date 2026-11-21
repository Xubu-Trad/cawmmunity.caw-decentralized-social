# explicit receipt rechecks with retained observations

baseline: `93a39cff7c6e96e478deaa9f283a9e6bb94c9565`.

## what changed

the local console can now explicitly recheck its most recent saved receipt against the selected local provider. connect the original submitting wallet and select the recheck button. this is a read-only operation: it never submits the transaction again.

each attempt appends an observation while preserving the original receipt and accounting review. the interface distinguishes a matching result, a receipt currently unavailable, a conflicting status or block, and an inconclusive check. a missing receipt alone does not establish a reorg or a dropped transaction. a provider or validation error is recorded as inconclusive, never as success. an earlier conflict remains visible even if a later attempt matches.

the existing receipt verifier is unchanged. it checks chain/account, original anchors, transaction fields, receipt/block coherence and relevant action events. this is still a selected provider's local view, not authenticated receipt inclusion or public-chain finality. current balances and the original accounting projection remain separate.

## preservation boundaries

observations are appended under the existing browser journal lock and read back before a saved result is reported. if the original archive changed during provider reads, the append is rejected. corrupt history, duplicate attempt identities, storage failures and history limits do not intentionally replace or prune earlier evidence. each action is limited to 64 observations and 65536 characters; reaching either limit stops further appends. the screen currently exposes the latest archived action, not a full archive browser.

these records are editable browser storage, not tamper-proof evidence. timestamps come from the local clock. no automatic recheck, new transaction, key handling or change to contract policy is introduced. provider requests retain the console's existing timeout. this package does not claim an independent reproduction or fresh chain execution.

## checks

18 targeted recheck controls passed: matching, missing, changed status/block, provider failure, malformed receipt, wrong chain/account and orphaned anchor; reload retention; concurrent archive change; duplicate identity; quota/lost writes; malformed or inconsistent history; full-history preservation; and no submission.

10 headless Chromium checks passed with controlled wallet/provider responses, covering retained missing/conflicting/error observations, reload, storage failure, retry without resend and desktop layout. the existing 22 outcome controls, 10 outcome browser checks and 331 action/journal/receipt tests also passed. visual review corrected an outdated label to state that saved receipts are not automatically rechecked; both browser suites passed again. earlier logs remain locally retained.

## reproduce

use Node 20.20.2 and the local-console dependency lock in this checkout.

```sh
node integration/local-console/test-receipt-rechecks.mjs evidence/console-receipt-recheck-20261115/accounting-withdrawal.json
node integration/local-console/test-receipt-outcomes.mjs evidence/console-receipt-recheck-20261115/accounting-withdrawal.json
node --test integration/local-console/test-post-plan.mjs integration/local-console/test-account-transfer-plan.mjs integration/local-console/test-withdrawal-plan.mjs integration/local-console/test-withdrawal-journal.mjs integration/local-console/test-receipt-status.mjs
```

expected: 18, 22 and 331 passing checks respectively. for browser reproduction, create a fresh directory containing this checkout as `src/` and the supplied `accounting-withdrawal.json` at its root. set `CHROME_BIN` to Chromium, then run:

```sh
node --experimental-websocket integration/local-console/test-receipt-recheck-browser.mjs /absolute/path/to/fresh-directory
node --experimental-websocket integration/local-console/test-receipt-outcome-browser.mjs /absolute/path/to/fresh-directory
```

expected: 10 checks each. harnesses start and stop their own loopback server/browser. use fresh directories on repeats and preserve failed evidence. the fixture is retained earlier Geth state; controlled receipt responses are deliberately varied by these tests.

next: make retained receipt/recheck records exportable for another reviewer, preserving the distinction between local observations and authenticated evidence. independent reproduction and unresolved paid-action economics remain separate gates; the frozen reproduction package is unchanged.
