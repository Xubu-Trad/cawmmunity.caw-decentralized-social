# exported posting receipts bound to verified local history

baseline: `c60791647f771cdfe4e388d42208d703a50bcf00`.

## what this adds

a reviewer can now compare a saved posting receipt with the signed transaction history, rather than stopping at an export checksum. the new command first checks the export structure, then runs the existing strict posting-history verifier on the supplied capture. it does not accept a precomputed verification summary as evidence.

the history verifier checks selected header continuity, transaction and receipt commitments, signatures, post text and ownership proofs. the binding then compares the exported transaction identity, sender, target, calldata, nonce, value, chain identifier, post details and saved receipt block/status with that verified history. it also checks that the saved review anchor precedes the post within the selected history.

results distinguish:

- `INCLUDED_POST_MATCHES_LOCAL_RECORD`: the post is in the selected verified history and the compared local fields match.
- `INCLUDED_POST_WITH_LOCAL_RECORD_DISCREPANCIES`: inclusion is verified, but named saved fields disagree or the review anchor lies outside the selected history. the original record is retained.
- `NOT_FOUND_IN_SELECTED_VERIFIED_POST_HISTORY`: the selected range does not contain that posting transaction. this is not proof that it never occurred or was dropped.
- `NOT_ACCEPTED`: invalid export, wrong selection, unsupported action or failed strict history verification. the CLI exits nonzero.

the CLI returns structured results without modifying the export or erasing earlier rechecks. a discrepancy or not-found result is not an acceptance pass even though the command completed its comparison. consumers must examine the status, not just exit code.

## scope

this path supports posting exports only. it does not authenticate withdrawal or transfer receipt outcomes, accounting effects, local observation timestamps, the producer of an export, public-chain consensus or finality. selected endpoints, contract code/layout selection, controller and local genesis context remain reviewer inputs. the supplied local state is structurally checked, not newly authenticated by this command. a matching transaction does not turn the rest of the exported accounting review or rechecks into chain proof.

the example exports were constructed for this test from an earlier retained signed Geth capture; they are not claimed as a fresh browser export or fresh chain run. `capture.json` and `selection.json` are retained from COMMUNITY_POST_HISTORY_20261113_V1. `fixture-context.json` retains only the public synthetic genesis/controller/contract context, excluding the old RPC endpoint. the source receipt/history verification limits were not relaxed. the frozen ownership reproduction package remains unchanged.

## reproduce

use Node 20.20.2 and the local-console lockfile. from the checkout root:

```sh
node integration/local-console/check-receipt-history.mjs evidence/console-receipt-history-20261115/post-export.json evidence/console-receipt-history-20261115/review-state.json evidence/console-receipt-history-20261115/capture.json evidence/console-receipt-history-20261115/selection.json
```

expected: `INCLUDED_POST_MATCHES_LOCAL_RECORD`, block `0xc`, transaction `0x5a2c7b20f4ff504c4ab4c3b83bd2fccd31fcc38ed7afd523426d537873dddb8d`, with public-chain authentication, consensus, execution replay and accounting-effect flags false.

copy the evidence directory to a fresh writable experiment directory before running the tests; the test creates `post-export.json` and `review-state.json` there. preserve prior and failed lanes.

```sh
node integration/local-console/test-receipt-history.mjs /absolute/path/to/fresh-evidence-copy
node integration/local-console/test-posting-history.mjs evidence/console-receipt-history-20261115/capture.json evidence/console-receipt-history-20261115/selection.json
```

13 new controls passed: contract-wallet and later EOA-owner positives; altered saved receipt status/block, transaction nonce, coherent alternate calldata/text and unselected review anchor; absent transaction; retention of an earlier inconclusive recheck; and rejection of changed signed bytes, receipt status, ownership proof or omitted block. the existing history regression also passed its two-post reconstruction and all 15 negative controls. the CLI example passed. these are retained-fixture results, not independent reproduction or production certification.

next: expose this separate local-observation versus verified-inclusion result in the console, retaining export/recheck history and rejecting stale verification responses. paid settlement and public operation remain separate unresolved roadmap gates.
