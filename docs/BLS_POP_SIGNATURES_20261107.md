# G2 and single-signature POP vectors — 2026-11-07

Research only. Parent: `d8b72610f210d8226bb9b5e288c0aaceb07caa02`.

## FACT — retained external inputs

The isolated BLS experiment now retains all fifteen `deserialization_G2` and twenty-nine `verify` cases from the same Ethereum bls12-381-tests v0.1.2 JSON archive: SHA-256 `0dc1dfabfa7b3e0f8e8029f9cb2bb8733597526fa085b18f160d2c4eb0b448bc`, 8,204 bytes. All 44 JSON members were extracted unchanged and have individual byte identities. The retained [upstream README](../evidence/bls-signatures-20261107/upstream-README.md) and formats are pinned to tag commit `89ff3a86f1a9b89a555495f7535c853cda589320`; the existing CC0 notice remains applicable. Release provenance and generator/build-origin limitations from [G1 research](BLS_G1_VALIDATION_20261107.md) remain unchanged.

The upstream README selects `BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_POP_`. The pinned library defaults to a different NUL tag. The adapter therefore passes the POP tag explicitly, with no caller override. On an identical positive external vector, the default fails and explicit POP succeeds. The shipped library source path used for this call hashes the message using the supplied tag before pairing verification. This is a concrete ciphersuite control, not adoption of every library default.

The retained G2 format text says `bytes92`; the actual valid vector encodings are 96 bytes. The adapter requires exactly 96 compressed bytes. That inconsistent format text remains unchanged and the unsupported 92-byte input is tested. G2 JSON members use unprefixed hex while verification members use prefixed hex; the harness validates and decodes each representation explicitly rather than silently changing the source files.

## FACT — adapter and executed results

`inspectG2Encoding` copies a 96-byte Buffer, decodes it through the pinned library, checks curve/subgroup validity and exact canonical re-encoding. Canonical identity may deserialize; `inspectPopSignature` rejects identity signatures and uses the existing nonidentity canonical G1 key validator. It requires one 48-byte public key, one 32-byte message and one 96-byte signature, then verifies using the explicit POP tag. No signing, secret-key generation, aggregate verification or application integration is added.

The successful result says `signatureVerifiedUnderSuppliedKey:true`. It explicitly keeps Ethereum consensus-domain validation, signing-root authentication, committee membership, proof-of-possession verification, overall bootstrap BLS validation, consensus/finality/update and production claims false. Selecting a POP ciphersuite does not itself verify a separate proof of possession.

Separate executed groups:

- **48/48 focused checks:** fifteen external G2 cases, twenty-nine external single-signature cases (ten expected true, nineteen false), and four local ciphersuite/message-mutation/API/identity controls.
- **42/42 key/committee regression checks:** existing G1 and minimal committee tests.
- **73/73 existing bootstrap regression checks:** structural and V1–V3 selection/composition.

A separately retained raw-G2 observation matched all fifteen expected decoder results. That finite result is not complete decoder conformance and does not erase the earlier raw-G1 infinity-encoding mismatch. The canonical adapter remains explicit. No failed test attempt occurred in this increment. Raw observations are not an additional test-suite count; these groups are not a full repository run.

Node v24.22.1 ran; declared Node24.20.0 did not. All 486 reused dependency files matched the prior inventory, with no reinstall or lockfile change. Exact commands, runtime binary identity, inputs and TAP logs are in [the evidence record](../evidence/BLS_POP_SIGNATURES_20261107.json). Disk >=2 GiB and memory >=1 GiB guards, 256 MiB heap, serial tests, 30-second test timeout and 45-second process deadlines were retained. Regression inputs stayed unchanged. Root dependencies, existing source modules, default tests and recovery/update acceptance remain unchanged.

## INFERENCE — ciphersuite versus consensus domain

The hash-to-curve DST selects the BLS ciphersuite. It is **not** Ethereum's consensus signing domain or `SigningData` root. This adapter verifies a supplied 32-byte message; it does not derive that message from a beacon header, fork version, genesis validators root or domain type. A valid signature under a supplied key does not establish that the key belongs to the trusted committee or that the message belongs to the intended network/fork/slot.

The result establishes only the bounded single-signature property on the retained vectors and defined controls. There is no committee participation selection, fast aggregate verification, proof-of-possession verification, update-transition rule, independently sourced checkpoint, real network/fork policy, recency or production acceptance. The pinned dependency versions remain research selections, with earlier provenance/security-review limitations intact. Full suite, declared runtime, build, EVM, live acquisition and CI were not run; hosted CI remains deferred.

## Reproduce and next gate

```sh
npm --prefix experiments/bls-g1 ci --ignore-scripts --no-audit --no-fund
npm --prefix experiments/bls-g1 run test:signatures
npm --prefix experiments/bls-g1 run probe:raw-g2
```

Installation is for a clean checkout; this run reused verified packages. Apply the resource and process-deadline guards recorded above. Project-authored code/docs are MIT-covered; existing noble MIT and vector CC0 notices remain.

IDEA — Next retain the external fast-aggregate-verification cases and review participant-set/key multiplicity and proof-of-possession assumptions before any committee-signature composition. Separately implement and test Ethereum consensus-domain/signing-root derivation against pinned evidence. Neither step may authenticate a self-selected checkpoint or enable update acceptance. Preserve explicit unsupported modes and all existing trust/recency/fork gates.
