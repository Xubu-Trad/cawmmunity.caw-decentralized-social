# Retained outside history reconstruction — 2026-11-06

The [Issue #3 review packet](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/issues/3#issuecomment-6676455487) now has a bounded local reproduction beyond [archive integrity](EXTERNAL_REVIEW_PACKETS.md). We ran our own readers at `346cb1c731366f655e37e44734cbb9c8814ffc18` against five retained JSON observations supplied by ahdmesh. No supplied executable or dependency installer ran.

## Result

Twenty checks passed on pinned Node 24.20.0 under the existing resource guard:

- Five datasets reconstructed and passed the London execution-header checks, including the older prefix.
- Both collector pairs agreed on history and manifest data.
- Twelve mutations removing, duplicating or reordering blocks, transactions, receipts or logs were rejected.
- The alternate branch was rejected under the original branch's selected manifest.

[Exact input hashes, runtime identity and results](../evidence/EXTERNAL_HISTORY_REVIEW_20261106.json). [Reproduction script](../scripts/review-acquired-history.mjs).

The first local run failed because the new review harness compared complete collector envelopes, including legitimately different acquisition metadata. Its source and output are preserved privately. The corrected comparison checks history and manifest fields; it does not discard the provenance distinction or claim byte-identical acquisition envelopes. The readers and supplied observations were unchanged. This was a review-harness error, not a discovered protocol defect.

## Reproduce

1. Download Issue #3's ZIP from the linked comment and verify SHA-256 `be872611c3bc096ed6aa1930a11f214d443c7fff08aa0dc718ded6e35f965a65` with the packet checker.
2. Inspect the archive, then copy only the five `collected.json` data files under `CAWmmunity_Issue3_E01_Evidence/RAW_OBSERVATIONS/RUN_002/`. Preserve the directories `branchA-A`, `branchA-B`, `branchB-A`, `branchB-B`, and `older-prefix`. No package scripts need to run.
3. Run from this checkout:

```sh
node --max-old-space-size=256 scripts/review-acquired-history.mjs /path/to/RUN_002
```

The output records each input's hash; compare it with the published result. The script uses a fixed five-file set and the current readers, not the archive's supplied verifier. The broader author-reported 31 JavaScript and 17 Python checks were not rerun here. These twenty checks are separate from the historical full-suite count.

## Trust boundary and next work

This reproduces retained-data reconstruction, not fresh acquisition, a second EVM execution, independent provider operation, transaction-body/state-proof verification, canonical selection, consensus, finality or freshness. A valid older prefix remains inspectable; that does not make it current. A selected replacement branch can also be internally valid; that does not authenticate its origin.

The packet's AT-02 question remains open. Existing recovery-bundle tests already reject a replacement under the retained selection pin and explicitly deny authentication even when the caller supplies a matching replacement pin. We did not duplicate those tests or promote a maintainer's digest to authority. Next define and independently evaluate either a separately operated validating-node trust path or a consensus/light-client trust path, including bootstrap provenance, network/fork binding, stale updates and conflicting evidence. Neither is adopted by this review. No release or economic policy changed; public test and production remain blocked.
