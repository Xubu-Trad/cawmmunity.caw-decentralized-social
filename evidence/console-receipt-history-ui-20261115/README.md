# strict receipt-history comparison in the console

baseline: `9d8714ad316029d311cf3392eec862be0909f401`.

## using the feature

after a posting receipt has been saved, choose **verify saved post against history** in the local console. no wallet connection or transaction submission is needed. the browser snapshots the saved record and retained rechecks, then sends that export to the loopback console server. the server acquires the selected signed history and ownership proofs through the existing bounded reader and runs the strict verifier. the client cannot supply its own claimed verification summary, endpoint or deployment selection.

the screen distinguishes a matching included post, inclusion with saved-field discrepancies, absence from the selected history, and rejected verification. withdrawal and transfer receipts are outside this posting verifier and are explicitly rejected. an absent transaction is not evidence that it never existed. the original archive, rechecks and accounting review are not rewritten by verification.

the result is bound to the exact export checksum and transaction identity. refresh, confirmation, receipt checking, rechecking and cross-tab storage changes clear the displayed result and cancel the active request. generation checks discard late responses even if a transport ignores cancellation. an interrupted export snapshot cannot revive a cleared result. malformed responses, missing verification fields and claims of public-chain finality are rejected.

## server boundaries

`POST /api/verified-receipt` accepts one `exportText` field. only this endpoint has a 220000-byte request-body ceiling, accommodating the bounded export envelope; the existing signing-plan limit remains 12288 bytes. export schema/size checks apply before acquisition. the same loopback origin checks, single-acquisition guard, RPC limits, read-only methods, 30-second acquisition budget, 128-block history bound, block-hash proof selectors and final endpoint rechecks remain in force. disconnects abort acquisition. no verification limit was relaxed.

results come from this local console server against operator-selected local headers and reviewed code/layout inputs. they are not browser-side cryptographic verification, public-chain consensus/finality, execution replay or verification of the saved accounting projection. independent reproduction remains pending. the frozen reproduction package and mission are unchanged.

## evidence and reproduction

use Node 20.20.2 with the local-console lock. copy this evidence directory into a fresh writable experiment directory first; the binding test creates its sample export/state files there.

```sh
node integration/local-console/test-console-receipt-history.mjs /absolute/path/to/fresh-evidence-copy
node integration/local-console/test-console-history.mjs /absolute/path/to/fresh-evidence-copy
node integration/local-console/test-receipt-history.mjs /absolute/path/to/fresh-evidence-copy
```

expected: 28 new endpoint/panel controls, 12 existing history-endpoint controls and 13 binding controls. the actual loopback server is exercised against retained signed Geth evidence served by a controlled read-only RPC adapter. tampered transaction bytes, receipts, proofs, missing receipts, RPC errors and changed endpoints reject. DOM-controller tests cover matches/conflicts/absence, response identity and scope, clearing failed acceptance, late results and cancellation during export. these are not a fresh Geth run or browser-wallet execution.

for Chromium checks, create a fresh directory containing this checkout as `src/` and the supplied `accounting-withdrawal.json` at its root. set `CHROME_BIN`, then run:

```sh
node --experimental-websocket integration/local-console/test-receipt-history-browser.mjs /absolute/path/to/fresh-browser-directory
```

expected: 14 checks. this exercises the real console/module wiring, existing export/recheck retention, and explicit rejection of a withdrawal from the posting-history button. positive cryptographic endpoint behavior is established by the separate retained-capture HTTP tests, not this browser adapter. visual inspection confirmed the new control and rejection text fit the desktop view. no fresh posting or real wallet signature is claimed.

all 67 scoped controls passed. next exercise the new console path after a freshly mined local post, including reload and interrupted verification, while retaining the same strict acceptance checks.
