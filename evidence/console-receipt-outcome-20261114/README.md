# receipt outcomes alongside the saved accounting review

baseline: `7f040718bf8ee9fd2dc61eda4cb08cc630dcd62a`.

## application behavior

after the existing matching local transaction/receipt check returns confirmed or reverted, the console saves that outcome together with the full submitted action and its original accounting review. it writes and reads back an archive entry keyed by action identity, then updates and reads back a latest-outcome pointer, and only then clears the pending journal. all steps use the same browser lock as pending-action updates.

the current interface displays the most recent saved outcome. earlier outcome entries remain stored by identity; this is not yet a full archive browser. each entry is limited to 10240 characters; the pending journal's 8192-character bound is unchanged. no automatic pruning is introduced. storage/quota failures keep pending recovery available rather than discarding the action.

the screen separates three things: the earlier expected accounting, a previously checked local receipt status, and current proof-backed balances. a reverted receipt explicitly says planned effects must not be treated as applied. a successful receipt does not certify the accounting projection. reload displays the retained check without automatically resending or claiming a fresh recheck.

## interruption and conflict handling

archive-write, pointer-write and pending-removal failures retain the pending action. retry can complete a partially saved identical result without resubmission. a conflicting saved result is not overwritten; pending recovery stays blocked for explicit investigation. malformed archive data and missing entries referenced by a pointer are reported as unavailable, not silently treated as empty history. legacy actions remain archivable without inventing an accounting review.

the archive is editable local storage. schema/action checks do not provide cryptographic authenticity. the receipt checker still uses the selected local provider's coherent transaction, receipt and block view; it does not establish cryptographic inclusion or public-chain finality. archived outcomes are not automatically rechecked for reorgs after reload. current balances must not be interpreted as effects attributable solely to this transaction.

## evidence

22 targeted archive checks passed, covering all three action types with confirmed/reverted results, preserved earlier outcomes, legacy records, invalid receipt summaries, wrong transaction, write/pointer/cleanup failures and retry, lost-write readback, conflicting outcomes, corrupt/missing pointers, lock contention and deployment mismatch.

10 headless Chromium checks covered pending versus resolved status, confirmed/reverted outcome retention and reload, mismatched receipt rejection, archive-write failure with pending retention, retry without resend and desktop layout. transaction/receipt responses were controlled local test adapters; no real signing or new chain execution occurred. the 14 signing-review and 18 pending-recovery browser checks also passed. 331 existing action, journal and receipt tests passed.

an initial broader test run was interrupted during a host disk-space incident. its incomplete logs were retained and are not counted as evidence. after reclaiming obsolete runtime caches, 60 unchanged public source files were matched to the pinned GitHub blobs (normalizing CRLF where needed), and the checks were rerun in a fresh V2 directory. no verification guard was relaxed; no project evidence or preservation checkpoint was deleted.

## reproduce

use Node 20.20.2 and the local-console lock:

```sh
node integration/local-console/test-receipt-outcomes.mjs evidence/console-receipt-outcome-20261114/accounting-withdrawal.json
node --test integration/local-console/test-post-plan.mjs integration/local-console/test-account-transfer-plan.mjs integration/local-console/test-withdrawal-plan.mjs integration/local-console/test-withdrawal-journal.mjs integration/local-console/test-receipt-status.mjs
```

expected: 22 targeted checks and 331 existing checks. for the browser checks, create a new directory with this checkout in `src/` and the package's `accounting-withdrawal.json` at the directory root. set `CHROME_BIN` to Chromium and run:

```sh
node --experimental-websocket integration/local-console/test-receipt-outcome-browser.mjs /absolute/path/to/fresh-directory
```

expected: 10 checks. the harness creates and stops its own loopback HTTP server and browser. use a fresh directory on repeats; retain failed lanes. the before/after state fixture comes from earlier retained Geth execution, not a fresh execution in this package.

next: add an explicit recheck of an archived receipt against the current selected provider and surface stale/conflicting results without overwriting the original check. independent reproduction and paid-post economics remain separate gates. the frozen ownership reproduction package is unchanged.
