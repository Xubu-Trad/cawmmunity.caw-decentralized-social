# November13 reviewer follow-up

## PR16 receipt envelope

At310d6a4e86b6f2f91f8d60fd0accfa4f30368f9d, WD-27 incorporated the proposed receipt envelope guard. We fetched the pinned package and reran all22 regression cases: genuine pair and permitted pending polling accepted, three error/missing-result mutations rejected with exit1. The test driver exited0. This closes the reproduced receipt-error false-acceptance boundary. It is not a new EVM run, a rerun of the separate Node checker, complete JSON-RPC schema validation or PR-wide approval. The PR has not been merged by this update.

## PR19 real batch report

[ahdmesh's report](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/pull/19#issuecomment-6848413977) supplies an externally executed local Geth batch at506b2db0d7009b0cea11c3fa3914799823b5f15c. Its archive SHA-256 is fd5d0d61836a6fa782e5648a5da5b4eefcc420f2a7ff1023da6c2c5d6838ddc7. We independently downloaded it, matched30 internal hashes, checked the three selected reader-file hashes and ran the unchanged strict reader against its positive/mixed/revert evidence. Two posts at block13/hash0xbe841e1a1fcee583b17b0b7c9e625b4167625395036ddc2a8900bcf34b61ad19 were reconstructed; mixed and reverted batches rejected with POST_ONLY_BATCH_REQUIRED.

The reviewer reports fresh Geth execution. Our follow-up corroborates the retained commitments and proof acceptance, not another fresh execution or the operator's identity/independence. Second-engine execution remains NOT RUN. The archive source manifest leaves ancestry unasserted from shallow retrieval, whereas the comment reports a later ancestry check; our follow-up does not resolve that difference or claim a new ancestry audit.

## Reproduction documentation and Chrono

The reported console README installation inconsistency is corrected to npm ci --ignore-scripts --no-audit --no-fund, matching the committed lock and setup guide. Other broad-review claims are attributed to the reviewer, not re-counted as tests performed here.

[Chrono's requested historical replay package](../evidence/chrono-replay-20261113/README.md) now includes exact generated JSON, source pins, hashes and logs. It explicitly marks unavailable historical numeric exit codes, separates script publication from the executed local preparation, and provides new offline-check exit receipts. The combined verifier preserves the previously known two oversized transaction rejections as INCOMPLETE/exit2; eight corruption controls pass. No T1/T2 independent execution or overall strict-history PASS is inferred.

Next engineering priority: second-engine execution of the reviewer's genuine batch, followed by intra-block authority reconstruction before permitting mixed blocks. Existing experimental paid settlement/asset decisions remain separate. No other build is resumed.
