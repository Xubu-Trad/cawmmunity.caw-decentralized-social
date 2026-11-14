# PR20 independent focused review

Reviewed head `11ed7a9bb2031affb6017dd9b554a3d6aa7d443d`. Three changed files add a cross-profile fixture, documentation and one model test. No production validator or normative text rule changes.

Node 24.20.0 ran the submitted model suite: 23/23 pass. Four separate fixture alterations reject: demo outcome, receipt status, calldata text and Posted event text. One altered fixture incorrectly passes all 23 tests: replace the empty-input callError with `Error: {"message":"unrelated diagnostic 7a2a029c","data":"0xdeadbeef"}`. The substring assertion matches the message instead of verifying the actual error-data field.

Requested correction: decode the retained error wrapper and compare the actual revert-data field with the exact no-argument InvalidText selector. Reject malformed/missing/wrong data even when the selector appears in descriptive text. Preserve original records and add the negative regression. This is a comparison-test acceptance issue, not a demonstrated Solidity defect.

The reduced evidence supports a useful distinction: demo whitespace rejection versus retained Probe acceptance. C-004 remains unresolved. This review verified the checked-in Probe source hash through the test but did not fetch/reverify the complete contributor archive, repeat the spaces-only EVM run, rerun the Paid Action suite or the full root suite, or authenticate chain history. Archive-member and historical-source equality assertions remain contributor-reported. No merge or protocol-policy adoption.


## November10 follow-up — corrected head `9238bb7eaef018fa13e9d1f35633a5a03efe82d6`

Independently reran the revised model suite on Node24.20.0:24/24 pass. The exact previous wrong-error-data mutation now rejects, as do the prior demo-outcome, receipt-status, calldata and event-byte mutations. The helper parses the retained JSON wrapper and compares its actual data field exactly;12 internal malformed/missing/wrong-data controls are present and pass. The previously requested error-data correction is resolved at this head. This is not a new EVM run, complete archive verification, full root-suite result, chain authentication or adoption of C-004 policy. No merge performed.
