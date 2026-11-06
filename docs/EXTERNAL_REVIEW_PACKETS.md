# External review packet integrity — 2026-11-06

Four reproduction archives supplied by ahdmesh were downloaded from the linked public issue comments. A separate standard-library checker compared their complete ZIP SHA-256 values with the posted values and recomputed every listed member hash (and listed size where present). No supplied script was executed or archive extracted. This is integrity verification, not an independent rerun of the reported EVM behavior, source provenance, signatures or RPC observations.

| Issue | Matched manifest entries | Review packet |
|---|---:|---|
| #1 | 51 | [review and download](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/issues/1#issuecomment-6677463273) |
| #3 | 212 | [review and download](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/issues/3#issuecomment-6676455487) |
| #6 | 78 | [review and download](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/issues/6#issuecomment-6675991546) |
| #7 | 570 | [review and download](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/issues/7#issuecomment-6676031726) |

All four external archive hashes match; 911 listed member hashes match. Each ZIP has six publication wrapper files outside the internal manifest, including its supplied verifier. These files are covered by the externally posted whole-ZIP hash. The result reports them explicitly rather than calling the internal manifest exhaustive. A matching hash binds received bytes to the posted digest; it does not establish who produced the experiment or whether its conclusions are correct.

## Reproduce this check

Download an archive from its review comment and obtain the digest from that comment, separately from the archive. Run:

```sh
python -I -B scripts/check_review_packet.py /path/to/archive.zip POSTED_SHA256
python -I -B tests/test_review_packet.py
```

The checker rejects mismatched archive/member hashes, unsafe paths, duplicate names and excessive expanded size. It reads bytes without executing package code. Four focused tests passed: a valid packet with a reported wrapper, wrong external digest, changed member with a recalculated ZIP digest, and an unsafe member path. This is not a general-purpose ZIP security certification. [Machine-readable checks](../evidence/REVIEW_PACKET_INTEGRITY_20261106.json).

## Engineering implications

- **#1:** C-001 remains HOLD. Retained rejection data and qualified runtime comparisons do not establish a successful positive-value historical fork, registration atomicity or agreement on an alternate burn rule.
- **#3:** Shared-node local acquisition does not authenticate a starting checkpoint. Next review should challenge a self-consistent replacement history against an independently justified trust input; matching balances, manifests or provider labels cannot supply that authority.
- **#6:** Delegation changes alone are not the current probe's signature-cancellation rule. The packet's selected synthetic wallet results still need independent execution and broader negative cases.
- **#7:** Controlled competition and relay loss are bounded local claims. Same-OS process separation does not prove independent infrastructure, public inclusion or sustainable costs.

All four issues remain open. The next execution review must first inspect the supplied harness and runtime/source pins, preserve failures and use disposable local identities. No dependency installation or third-party execution was performed in this integrity review. No economic or cancellation policy changed. Public-test and production gates remain blocked; hosted CI remains deferred. Existing full-suite totals were not rerun or increased by these four checker tests.
