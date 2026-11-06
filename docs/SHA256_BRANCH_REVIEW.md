# SHA-256 branch inclusion prerequisite

This isolated research module checks a leaf's inclusion beneath a supplied SHA-256 root. It is a prerequisite for exploring a consensus/light-client trust path, **not a light client or a solution to checkpoint trust**. It is not wired into recovery adoption, settlement or the frontend.

## Source and scope

The algorithm follows the branch orientation and root comparison in Ethereum's [pinned phase0 specification](https://github.com/ethereum/consensus-specs/blob/204fb4a19774eabb7a2e91505365deed6b8afef8/specs/phase0/beacon-chain.md#is_valid_merkle_branch). Ethereum's light-client protocol requires substantially more than this primitive. No network/fork profile or bootstrap is selected here.

The [module](../reference/sha256-branch.mjs) accepts bounded JSON with exact fields, 32-byte lowercase hex values, depths 0–32, and an index within the selected depth. This local depth cap is a review bound, not a claim of supporting every consensus structure. Siblings are ordered leaf-to-root. It rejects length mismatches rather than ignoring extra proof nodes. Duplicate JSON fields, extra authority claims and malformed values reject.

Success reports inclusion only and explicitly returns rootAuthenticated=false, consensusVerified=false, finalityVerified=false and productionAccepted=false. A caller who supplies a different consistent root can obtain inclusion under that root; no permission or canonicality follows.

## Evidence

Eleven focused tests passed under the existing resource guard on Node24.20.0. Python hashlib constructed a full synthetic sixteen-leaf tree; every depth-four leaf position verifies in JavaScript. Additional synthetic vectors cover depth zero and the largest supported depth/index. Changed roots/leaves/siblings, branch order, positions, lengths, number ranges, malformed byte strings, duplicate fields and oversized inputs reject. A replacement-root control retains false authentication flags.

[Results and source hashes](../evidence/SHA256_BRANCH_RESULTS.json). These are our synthetic vectors, not official consensus conformance vectors or external peer review. Both languages ultimately depend on their cryptographic libraries; cross-language agreement alone does not certify cryptographic correctness.

```sh
python -I -B scripts/generate-sha256-branch-vectors.py
node --test tests/sha256-branch.test.mjs
```

The generator deterministically rewrites only the synthetic fixture file. The test is also included in the package's explicit test list; the historical full-suite total has not been rerun or increased here.

## Remaining work

Next test against independently sourced consensus vectors and add explicit fork-specific SSZ roots and execution-header binding before considering light-client composition. Bootstrap provenance, network identity, committee/signature verification, update ordering, stale/conflicting updates and finalized state selection remain unimplemented. A supplied root or maintainer signature must not substitute for these checks. This experiment selects neither the validating-node nor light-client production design and closes no recovery/release gate. Public test and production remain blocked; hosted CI remains deferred.
