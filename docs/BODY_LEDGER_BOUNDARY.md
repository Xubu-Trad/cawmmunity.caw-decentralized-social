> historical boundary experiment: the positive-acquisition gap below was subsequently exercised by [signed ledger reconciliation](SIGNED_LEDGER_RECONCILIATION.md). production and independent-provider claims remain open.

# signed-body and selected-ledger boundary

FACT -- nine focused groups pass. the retained executed-ledger capture passes its existing proof/replay check; both retained signed withdrawal branches pass their existing body/sender/receipt-root checker. these are separate positive controls. neither establishes a positive joint capture.

the new experimental reader requires the same history to pass both existing readers. it accepts two bounded JSON strings: the existing ledger-history envelope and a complete body-capture array. each retains the existing 1 MiB JSON maximum. no caller-supplied verification flags are accepted. absent bodies and either separately valid signed branch grafted onto the different executed-ledger capture are rejected. object input and extra arguments are rejected too.

UNRESOLVED -- jointPositiveCaptureVerified is false. the earlier executed ledger used impersonation; the signed branch capture lacks the complete paid-ledger witnesses. a fresh acquisition must collect genuine fixture-key-signed transactions, complete bodies/receipts and the 13 paid-ledger slots plus registry witnesses at one selected endpoint. the new reader's success path has not yet been demonstrated and must not be treated as an accepted recovery path or integrated into the frontend.

the intended stronger result remains bounded to selected local test contracts and the captured blocks after the anchor. it does not authenticate the endpoint or anchor body, prove EVM execution, external token backing, production wallet authority, withdrawal safety, consensus, finality or freshness. all those flags remain false. no production gate closes. no contract or dependency changed.

## reproduce the boundary checks

```text
node --max-old-space-size=256 experiments/registry-bootstrap/check-body-ledger.mjs
```

[reader](../experiments/registry-bootstrap/body-ledger-reader.mjs), [checks](../experiments/registry-bootstrap/check-body-ledger.mjs), [results and source hashes](../evidence/BODY_LEDGER_BOUNDARY_RESULTS.json). the checks reuse the two already published captures without modifying either. this is nine focused groups, not a rerun of the full suite. the first local run inherited an unused positional argument; the clean command above was rerun and passed, and both records are retained.
