# verified accounting in the local console

baseline: `d25c1a9d6c495593b5b94e90644e57de4cb53c51`.

## application change

the current-account panel now shows whether accounting passed verification, the exact selected block hash and total unpaid liability alongside credit and token balances. the browser requires both authority and accounting verification results to match that block and rejects malformed or inconsistent summary values.

refresh immediately clears the previous values and action review. if proofs fail or the response is inconsistent, balances stay blank and action buttons remain disabled. a later successful refresh restores the verified snapshot, including a legitimate zero-credit balance. the displayed hash wraps inside the panel.

the local server verifies the cryptographic proofs. the browser displays and checks that server's result; it does not run the complete proof reader itself. this trust boundary is written on the screen. verification is relative to selected local headers and research contract layouts, not public-chain consensus, arbitrary tokens or real-asset safety.

## evidence

32 HTTP checks ran against a fresh local Geth through a mutating RPC proxy. the four routes were state, withdrawal plan, account-transfer plan and post plan. valid and recovered responses passed. each route rejected missing custody proof, missing token proof, missing liability slot, conflicting storage-proof value, contradictory credit call and contradictory token-balance call. every negative control asserts that its mutation was actually reached and that no action plan was returned. these controls submitted no transactions.

the surrounding fresh execution still transferred ownership, posted and withdrew the remaining credit. EthereumJS matched 14 signed transactions and 15 post-genesis state roots, including gas, receipt status and logs. the additional root is an empty mined block, not another user action.

12 real headless Chromium checks exercised the UI with controlled HTTP snapshots retained from that fresh run: verified values/block display, connected-signer planning, clearing during delayed refresh, recovery, missing verification flag, mismatched block, conflicting liability, missing balances, server proof rejection, zero-credit retry, no transaction requests and desktop layout. the injected wallet was a read-only test adapter, not a wallet extension. this is not independent-operator reproduction.

the 17 accounting, 12 authority, 15 acquisition, 11 interruption and 110 action-plan regression checks also passed. Windows browser startup attempts failed before UI validation. the first Linux UI fixture incorrectly refused a numeric module filename; that test-server issue was corrected. failed lanes remain retained locally. the final Linux browser result is the reported pass; no verification rule was weakened.

## reproduce

use the selected console's Node 20.20.2 lock and the existing verified Geth setup. for fresh mining, place the checkout in `src/` beside `mine-accounting-display.py` and `lane.mjs`; copy `evidence/console-safe-transfer-20261113/post-authority-sequence-before-safe.mjs` into `src/integration/local-console/`. set `GETH_BIN` and run `python3 mine-accounting-display.py positive` in a new directory. this invokes the RPC rejection controls before the final withdrawal. replay the generated capture/genesis using the existing locked second-engine procedure. the portable wrapper has not been rerun by another operator.

for the browser test, create a fresh fixture directory with a copy of `integration/local-console/ui/` named `ui/` and this package's `accounting-withdrawal.json`. set `CHROME_BIN` to your Chromium executable and run:

```sh
node --experimental-websocket integration/local-console/test-accounting-browser.mjs /absolute/path/to/fixture-directory
```

expected: 12 checks. output goes to a new `browser/` subdirectory; use a fresh directory for a repeat. no real wallet keys or funds are needed. the browser test creates and stops its own local HTTP server and headless browser.

the earlier ownership reproduction package remains frozen. do not replace its files with this increment. independent reproduction, actual wallet-extension compatibility and public-network readiness remain separate gates.

next: show the expected credit and balance effects in action review and test changed accounting before wallet submission. paid posting remains an unresolved specification/accounting integration, not a fee silently added to this experiment.
