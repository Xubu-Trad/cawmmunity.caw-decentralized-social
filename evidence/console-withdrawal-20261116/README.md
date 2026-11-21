# console withdrawal proof acquisition

baseline: `95912c58406be57cbcae55a2bca6c3a9aab30126`.

the local console's **verify saved action against history** button now accepts an EOA withdrawal receipt. the server locates its block, retrieves signed transaction bytes and block-hash-selected authority, custody and token proofs before and after it, then invokes the strict withdrawal effects reader. receipt metadata is a locator, never proof of sender, amount or payment. the signed calldata supplies the verified amount; a different saved amount stays visible as a discrepancy instead of changing the verification target.

the existing local chain/genesis checks, 30-second acquisition deadline, request/byte budgets, same-origin endpoint restriction and display cancellation rules remain in force. endpoint hashes are rechecked before a result is returned. missing receipts/proofs, changed roots, reorgs and unsupported block shapes reject. no transaction is submitted by verification. original receipts and rechecks remain unchanged.

the display distinguishes matching saved details from discrepancies and says when custody, credit and recipient token changes were checked. an accounting flag is required for withdrawal acceptance; post/transfer results retain their existing accounting-unverified status. an older review anchor outside the two selected adjacent headers is explicitly reported as outside this selected history, not silently accepted or called a proven forgery.

## evidence and checks

31 endpoint/acquisition/display controls passed using preserved real signed evidence through a controlled read-only RPC server. these cover altered bytes/receipts/proofs, wrong chain/genesis, multiple transactions, reorg, saved amount/epoch/nonce/status/block discrepancies, foreign origin, malformed export, interrupted acquisition/retry and late display responses. 28 existing posting/transfer endpoint controls and 14 headless Chromium receipt/export regressions also passed: 73 scoped checks.

a fresh isolated Geth run then executed ownership transfer, posting and an EOA withdrawal. live RPC acquisition returned `INCLUDED_WITHDRAWAL_MATCHES_LOCAL_RECORD` with accounting effects verified. the exact export, new boundary proofs, complete synthetic capture and result are in `fresh/`; shutdown is recorded. this fresh run is local acquisition evidence, not an independent operator reproduction or browser-extension wallet test. the earlier second-engine replay remains recorded in the preceding withdrawal-effects package; this new run is not represented as replayed.

two test setup failures are preserved: the first HTTP fixture omitted a deployment-hash field required by the console configuration; the first browser regression still expected withdrawals to be unsupported and did not supply a verification response. the fixtures were corrected, with the browser now exercising an explicit proof-unavailable error and no resubmission. production verification checks were not weakened.

## reproduce

use Node 20.20.2 and the existing `integration/local-console/package-lock.json` installation procedure. copy this evidence folder to a fresh writable directory because the controls write their result and synthetic receipt export there:

```sh
node integration/local-console/test-console-withdrawal.mjs /absolute/path/to/evidence-copy
```

expected: 31 controls. the test starts and stops its own loopback console and recorded RPC server. it does not send transactions. for the 28 post/transfer controls use the preceding `console-transfer-receipt-20261115` evidence as documented there. the 14 browser controls use a fresh directory containing this checkout as `src/`, this package's `accounting-withdrawal.json`, and `CHROME_BIN`; run `node --experimental-websocket integration/local-console/test-receipt-history-browser.mjs /absolute/path/to/fresh-browser-directory`.

## limits and next work

only EOA withdrawals from the selected research fixture in single-transaction blocks are supported. contract-wallet withdrawals, arbitrary tokens, mixed-block attribution and public consensus remain unsupported. proofs are bound to selected local headers and code hashes; they do not establish public-chain finality. the console does not replay execution and its executionReplayed flag remains false.

next make the acquired withdrawal proof package exportable with the exact selected headers and configuration, so another reader can check the console's result offline. the saved receipt export currently contains observations, not the acquired proof package. independent reproduction, full protocol economics and public operation remain pending. mission unchanged.
