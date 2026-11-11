# Receiver restart after partial synchronization

## Fixed comparison

Based on the public `run-replacement-peer.py` fixture at bf60d21155202f3631cd8c430e73c3c199d3dd24. Source A supplies blocks 1–14, then stops. Fresh Reth has reported block 14/VALID; the target 28 remains absent and requests return SYNCING with no peers. The added variable is receiver shutdown and restart before replacement B connects.

- `run-prefix-restart.py`: SIGKILL, exit -9. Same receiver database and peer identity. **FAIL:** the first post-start eth_blockNumber was 0, not 14. The assertion stopped the test before replacement recovery. No claim is made about subsequent recovery, disk corruption, or a client defect.
- `run-prefix-graceful.py`: SIGTERM, orderly exit 0 at the same point. **PASS:** 15 prefix headers including genesis retained matching hashes/state roots with zero peers. Replacement B completes block 28; all 29 headers, 16 selected proof fields and five rejection controls pass. Original source stays stopped.

These use the same arguments as the independent reproduction guide. Use fresh outputs. The abrupt driver is an intentionally retained failing regression, not a passing test. Do not remove its retention assertion to manufacture a pass. Existing output directories must never be overwritten.

The receiver had reported a settled execution head, but no durable persistence boundary or active database write was observed. Immediate restart timing, buffering and persistence policy remain hypotheses. No public finality was supplied. Next isolate peer-free post-start retention with fixed observations and inspect persistence behavior before attributing a defect. All processes stopped in both runs. Same host/operator and externally selected synthetic heads remain limitations.

## Independent review of earlier tests

[ahdmesh R03](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/pull/19#issuecomment-6788874338) reports independently executing baseline acquisition, third-peer recovery and genesis-only receiver restart at bf60d21155202f3631cd8c430e73c3c199d3dd24. We verified the supplied ZIP digest 83ec74524189f3801c5b31397c2da415f2a00d06414aff69374d372fc95fb020 and all 139 manifest entries, checked recorded successful driver exits/cleanup, and reran our unchanged strict reader against the three A/B/C-signed proofs: 16 fields plus five mutations pass for each. This is retained-evidence corroboration of the reviewer's independently reported execution, not observation of their machine. Client signature verification is reviewer-reported, not reverified in our archive check. Separate-host operation, public consensus, malicious peers and PR-wide acceptance remain unproven. Their verdict does not cover the new prefix-restart failure.


## Persistence-policy follow-up

[The fixed-assertion threshold comparison](PREFIX_PERSISTENCE_REVIEW.md) supports buffered/unpersisted history as the explanation for the earlier abrupt-restart failure. The failure remains preserved; the new control is separately scoped and does not prove general crash durability.
