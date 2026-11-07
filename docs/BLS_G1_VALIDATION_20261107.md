# BLS G1 public-key prerequisite — 2026-11-07

Research only. Parent: `ac280a5f882586aa85406674e372f99e8760a7b4`.

## FACT — scope and inputs

The captured-source experiment remains complete research; this increment returns to the [bootstrap cryptography gate](BOOTSTRAP_TRUST_REQUIREMENTS.md). `experiments/bls-g1/` contains an isolated adapter and test package. No root dependency, application acceptance, bootstrap composition or captured-source mechanism changes.

The experiment pins `@noble/curves` 1.9.7 and `@noble/hashes` 1.8.0 in its own package and lockfile. These are selected research versions, not a claim of latest release, current security clearance or production suitability. Installation used `npm install --ignore-scripts --no-audit --no-fund`; no lifecycle scripts or registry audit ran. Both downloaded tarballs matched their locked SHA-512 integrity, and all 486 installed package files matched their corresponding tar members byte-for-byte. The package SHA-256 identities, exact file inventory and MIT notices are retained. Registry signatures/attestations were not verified and source-to-package builds were not reproduced.

The installed curves `src/bls12-381.ts` also matched Git blob `cb8d6aa2a84a50aab7b5c4b446f2d1b7469af929` at the registry-claimed source commit `a0ac59846ee76c52f7c18886f4963e1211345d48`. This single source-file match is not a complete build-origin proof. Source inspection of the shipped curve and Weierstrass implementations confirmed the invoked validity check includes the curve equation and prime-order subgroup predicate. No new elliptic-curve arithmetic is implemented here.

External expected results come from [ethereum/bls12-381-tests v0.1.2](https://github.com/ethereum/bls12-381-tests/releases/tag/v0.1.2), whose tag resolved to `89ff3a86f1a9b89a555495f7535c853cda589320`. The downloaded JSON archive was 8,204 bytes, SHA-256 `0dc1dfabfa7b3e0f8e8029f9cb2bb8733597526fa085b18f160d2c4eb0b448bc`. All thirteen `deserialization_G1` JSON members were retained unchanged with per-member identities and the source project's CC0 notice. This is observed release-asset provenance, not a reproduced generator run or a signed-asset verification. The format document mentions prefixed hex, while these actual JSON members use unprefixed lowercase hex; the harness checks the actual retained format explicitly.

## FACT — discrepancy and correction

The first run produced **28 passes and 1 failure across 29 checks**. The raw pinned library accepted `deserialization_fails_with_b_flag_and_a_flag_true.json`, while the external expected result is false. The bytes encode infinity with the sign bit set. The library decoded them to the identity and re-encoded different canonical bytes. The nonidentity public-key wrapper already rejected this input, but raw decoder conformance failed. This is a bounded raw-decoder mismatch, not a claim that all library cryptography is broken or that a live exploit exists.

The adapter now requires exactly 48 Buffer bytes, copies them, calls the library's decoding/validity check and requires exact compressed re-encoding equality. `inspectG1Encoding` admits canonical infinity as the external deserialization format does; `inspectG1PublicKey` separately rejects the identity. The one-bit control clears only the sign bit: deserialization then succeeds, while public-key admission still rejects. External expected results were not changed. The original source/test and failed TAP are retained; the public failed TAP replaces only the local absolute checkout path with `<CHECKOUT>`, with original and sanitized hashes recorded. The raw original remains locally preserved.

The **final 30/30 focused checks** comprise thirteen external deserialization cases, thirteen corresponding nonidentity-key-policy cases, three API controls and one explicit raw-library-discrepancy/one-bit control. The adapter matches all thirteen external decoder expectations. The unchanged raw library matched only twelve of thirteen in the initial run. Do not represent the final adapter pass as raw-library conformance or combine initial/final counts. A separate existing regression passed **44/44**. This is not a complete BLS suite or a full repository run.

## INFERENCE — what the result means

For an admitted individual key, this adapter reports canonical compressed encoding, curve membership, prime-order subgroup membership and nonidentity. A malformed/off-curve/wrong-subgroup vector rejects. That bounded property does not authenticate committee membership, establish an aggregate-key relationship, verify any G2 signature or signing domain, or prove consensus/finality/freshness. The aggregate `blsValidated`, root/network authentication, signature, update and production flags remain false. Canonical infinity is a serializable group element, not an admissible individual public key under this research rule.

The library's signing defaults are not selected as an Ethereum signature policy. This experiment invokes no signing, signature-verification, aggregation, pairing or key-generation API. G1 deserialization results must not be promoted to complete Ethereum BLS compatibility. The library/dependency/toolchain provenance and limited vector set remain assumptions and review limits.

## Reproduce

```sh
npm --prefix experiments/bls-g1 ci --ignore-scripts --no-audit --no-fund
npm --prefix experiments/bls-g1 test
```

Use an isolated checkout and retain package hashes before testing. The executed runtime was Node v24.22.1, binary identity and exact commands recorded in [the machine-readable result](../evidence/BLS_G1_VALIDATION_20261107.json). The declared Node24.20.0 was not run. Tests used a 256 MiB heap, serial execution, a 30-second test timeout and an external 45-second process deadline; disk >=2 GiB and memory >=1 GiB guards were applied before the final groups. Inputs including installed dependency files remained unchanged across those groups. The snapshot is partial; full suite, build, EVM, live acquisition and CI were not run. Hosted CI stays deferred.

## IDEA — next bounded gate

Compose individual G1 validation with the retained 32-member minimal committee, keeping structural inclusion separate. Check the supplied aggregate public key against the sum of admitted committee keys using fixed external evidence and explicit negative controls. Do not infer authenticated committee authority from that equality. G2/signature/domain vectors, real network/fork configuration, checkpoint provenance/recency and update-transition rules remain subsequent separate gates. No independent trust source or production BLS library is adopted by this experiment.

Original adapter/tests/docs are MIT-covered. The retained Ethereum vectors are CC0; noble packages retain their own MIT notices. Neither third-party license nor a passing test constitutes an audit or endorsement.
