# receipt and recheck export for independent review

baseline: `b10167cfaffaa182cfaf64a56b53e4277e43adaf`.

## use the export

the local console now offers **export saved receipt and rechecks** beneath its most recent saved outcome. it works after reload without connecting a wallet. the download includes the original submitted action, any saved accounting review, the original receipt summary, and every retained recheck for that action. no provider call or transaction submission is needed. the browser receives a download request; the console does not claim to have verified that your browser saved the file to disk.

the current interface exports the latest saved action only. older archives remain stored; this is not a bulk archive browser or backup of all browser storage. records are not removed after export. malformed history or an archive changed since selection blocks export. export takes a snapshot under the same lock used for receipt updates; later observations require another export.

review before sharing: the file contains addresses, transaction calldata, and any posted text already in the saved action. it exports only selected receipt/recheck records, not unrelated browser storage, wallet keys or runtime configuration.

## what the checker establishes

the JSON envelope contains an exact payload string and its SHA-256 checksum. the offline checker checks the checksum, strict record structure, action/contract selection, accounting-review structure, and consistency of recheck classifications against the original receipt. it requires a separately selected local-state file rather than treating state embedded in the export as authority.

these are editable local observations. anyone can change coherent records and recompute a checksum. the checksum detects changes relative to its included digest; it does not authenticate the producer, prove receipt inclusion, establish public-chain finality, verify the supplied state or demonstrate independent execution. a valid result is explicitly named `LOCAL_RECORD_STRUCTURE_AND_CHECKSUM_VALID`, not protocol PASS. unavailable, conflicting and inconclusive observations remain in the package.

no import into live browser storage is implemented. the offline checker is read-only. the existing receipt and authenticated-history verifiers are unchanged.

## reproduce

use Node 20.20.2 and the local-console lockfile. for the supplied synthetic export:

```sh
node integration/local-console/verify-receipt-export.mjs evidence/console-receipt-export-20261115/export.json evidence/console-receipt-export-20261115/accounting-withdrawal.json
```

the second argument is a state object or a retained fixture with a `before` state. select the state and deployment independently for your review; a successful structural match does not authenticate that state. expected: four retained observations, with the bounded status above. the browser download example contains seven observations and can be checked with the same command after substituting `browser-download.json`.

to reproduce controls, choose a new output file:

```sh
node integration/local-console/test-receipt-export.mjs evidence/console-receipt-export-20261115/accounting-withdrawal.json /absolute/path/to/new-export.json
node integration/local-console/test-receipt-rechecks.mjs evidence/console-receipt-export-20261115/accounting-withdrawal.json
```

expected: 21 export controls and 18 existing recheck controls. the export controls include all three action types with confirmed/reverted results, legacy records without an accounting review, retained conflicts, identical snapshots, checksum changes, invalid history, wrong contract selection, size limits and lock conflicts. a recomputed checksum cannot bypass the semantic checks, but coherent fabrication remains possible.

for browser reproduction, create a fresh directory with this checkout in `src/` and `accounting-withdrawal.json` at its root. set `CHROME_BIN` to Chromium and run:

```sh
node --experimental-websocket integration/local-console/test-receipt-export-browser.mjs /absolute/path/to/fresh-directory
```

expected: 13 checks. these include the previous recheck/reload/storage-failure scenarios, a download after reload without wallet connection, browser checksum validation and refusal to export corrupted history. the harness captures the exact download Blob; it does not exercise an operating-system save dialog. controlled provider responses and retained synthetic state are used, not fresh chain execution. servers and browsers are stopped by the harness. preserve failed lanes and use fresh directories on repeat runs.

all 52 scoped controls passed, and the offline CLI accepted the supplied four-observation export. independent reproduction remains pending. the frozen ownership reproduction package is unchanged.

next: connect selected exported transaction identities to the existing authenticated-history review, reporting local observations and independently verified inclusion as separate results.
