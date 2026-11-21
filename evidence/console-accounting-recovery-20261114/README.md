# reviewed accounting survives pending-action recovery

baseline: `e1cab9c1772176cad756887d09e7bd561dbd272f`.

## application behavior

new console actions retain the reviewed accounting snapshot inside the same local journal entry as the transaction intent. it is saved and read back before requesting the wallet, under the existing browser lock. the snapshot includes the selected deployment, review block, account authority, credit, liabilities and token balances. expected effects are recomputed from that snapshot and the validated action bytes rather than stored as a separate editable result.

after reload, unresolved and submitted actions display **saved expected accounting — not a confirmed result**. current verified balances remain in the current-account panel. the saved review is not replaced with today's state when ownership, credit or balances change. matching a recovery transaction hash preserves the original review and does not establish that it executed. there is no automatic resend.

older records without accounting metadata remain recoverable. the interface explicitly says their review is unavailable instead of inventing one from current balances. malformed or mismatched review metadata is retained for inspection, blocks action recovery/submission through the existing journal error path, and is not shown as a valid review.

the existing journal versions remain 1/2/3 for withdrawal/transfer/post. an optional `accountingReview` field has its own version 1 schema. the new UI supplies it for all three actions. old callers can still create legacy records without it. the 8192-character read limit is unchanged and is now also enforced before writing. the maximum four-byte 420-scalar post fixture with review occupies 6833 characters and passes readback.

## trust and lifecycle boundaries

this metadata is editable browser storage, not a signature or historical state proof. schema, action and deployment checks reject inconsistent records, but coherent local edits cannot be detected as forgery. a specific test demonstrates that limit. the recovered panel labels it clearly and never promotes saved verification flags into fresh cryptographic acceptance.

fresh state acquisition and the existing pre-wallet checks still govern new actions. pending records continue blocking duplicates. the review survives `rememberHash`; it is cleared together with the action only through the existing resolved/explicit-rejection/pre-send cleanup path. resolved-action archival is not added here. receipt checking remains the existing coherent local-provider check, not public-chain finality or authenticated accounting attribution.

## evidence

31 targeted checks passed across all three actions: atomic intent/context persistence, reload under changed current state, hash recovery, replacement-hash rejection, cleanup, legacy compatibility, malformed or mismatched metadata, storage failure/readback failure, concurrent pending records, size bounds and the editable-record trust limitation.

18 headless Chromium checks exercised unknown wallet outcomes, reload, current zero credit versus the retained earlier expectation, duplicate-action blocking, matching synthetic hash recovery, submitted reload, legacy handling, invalid metadata and desktop layout. no reload requested another transaction. the wallet and transaction responses are controlled test adapters, not actual signatures or new chain execution.

211 existing action/journal tests and the 14 prior signing-review browser checks also passed. the saved before/after chain fixture is retained from the preceding Geth execution; these tests add application recovery evidence, not a fresh chain run or independent operator reproduction.

## reproduce

use Node 20.20.2 and the local-console dependency lock:

```sh
node integration/local-console/test-accounting-recovery.mjs evidence/console-accounting-recovery-20261114/accounting-withdrawal.json
node --test integration/local-console/test-post-plan.mjs integration/local-console/test-account-transfer-plan.mjs integration/local-console/test-withdrawal-plan.mjs integration/local-console/test-withdrawal-journal.mjs
```

expected: 31 targeted checks and 211 existing checks. for the browser checks, create a fresh directory with the checkout in `src/` and this package's `accounting-withdrawal.json` at its root. set `CHROME_BIN` to your Chromium executable and run:

```sh
node --experimental-websocket integration/local-console/test-accounting-recovery-browser.mjs /absolute/path/to/fresh-directory
```

expected: 18 checks. the harness creates and stops its own loopback HTTP server and headless browser. no wallet keys or real funds are required. use fresh output directories; retain failed attempts.

the frozen ownership reproduction package remains unchanged. next preserve and present the resolved receipt outcome alongside the earlier expectation, while keeping local receipt checks, verified current balances and transaction-attributed effects distinct. paid economics and independent reproduction remain unresolved gates.
