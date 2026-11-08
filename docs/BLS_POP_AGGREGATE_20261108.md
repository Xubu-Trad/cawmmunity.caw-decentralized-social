# Supplied-key aggregate equations — 2026-11-08

Research only. Parent: `c4b033719f7d29c729f5614fcde4944d199bcb1b`.

## FACT — what changed

The isolated `inspectPopAggregateEquation` experiment validates between 1 and 32 supplied canonical nonidentity G1 public keys, sums them with multiplicity, rejects an identity sum, and verifies a supplied 32-byte message and canonical nonidentity G2 signature through the existing explicit-POP adapter. No participant-selection bitfield or committee composition is added. The 32-key cap is a research resource limit, not evidence of mainnet's 512-member committee support. Empty lists are rejected; this is not Ethereum's special empty-participation wrapper.

The positive properties are `aggregateEquationVerified` and `publicKeysValidated`. Participant-set authentication, committee membership, possession proofs, signer authorization, Ethereum signing-domain validation, checkpoint authentication, full bootstrap BLS validation, consensus, finality, updates and production acceptance remain false. This experiment has no application/recovery integration or authority override.

## FACT — retained sources and scoped execution

All twelve `fast_aggregate_verify` JSON members were extracted unchanged from the existing Ethereum bls12-381-tests v0.1.2 archive, SHA-256 `0dc1dfabfa7b3e0f8e8029f9cb2bb8733597526fa085b18f160d2c4eb0b448bc`, 8,204 bytes. There are three positive and nine negative cases. Each retained member has a byte identity in [the vector inventory](../evidence/bls-aggregate-20261108/vector-inventory.json). The [upstream format](../evidence/bls-aggregate-20261108/upstream-format.md) is retained at commit `89ff3a86f1a9b89a555495f7535c853cda589320`; the previous README supplies the POP ciphersuite. Existing CC0 vector and MIT dependency notices remain applicable. No release signature or generator build was newly verified.

Separately executed groups:

- **21/21 aggregate checks:** twelve external vectors and nine authored controls.
- **90/90 BLS regressions:** existing G1, committee and single-signature checks.
- **73/73 bootstrap regressions:** existing structural and V1–V3 selection/composition checks.

Controls cover key permutation, one omitted key, one added duplicate, multiplicity versus deduplication, one message-bit mutation, zero-sum keys, unsupported inputs, the 32-key bound and the compensating-key construction below. Reordering keys preserves a sum but authenticates no ordered committee. Repeating a key with the correspondingly multiplied signature preserves multiplicity; silently deduplicating it changes the equation. Those transformed signatures are authored algebraic controls, not additional external vectors or real participant signatures.

Node v24.22.1 executed, not declared Node24.20.0. All 486 reused dependency files matched the existing inventory. No reinstall, dependency/lock change or root script change occurred. Existing regression sources were unchanged. Guards retained at least 2 GiB free disk and 1 GiB available memory, 256 MiB heap, serial tests, 30-second test timeout and 45-second process deadlines. All three first attempts passed; no failed execution was discarded. The earlier raw G1 mismatch, its failed attempt, and the historical binding checksum discrepancy remain preserved. These groups are not a full repository run. Build, EVM, live acquisition, declared-runtime and CI checks were not run; hosted CI remains deferred.

## FACT — compensating-key control

Start with an external valid single-key case `(A, message, signature)`. Select the G1 base point `B`, and compute `C = A - B`. Both supplied keys pass canonical nonidentity curve/subgroup checks, and `B + C = A`. The unchanged signature therefore passes the aggregate equation for `[B, C]`. The control uses no private keys, signatures or possession proofs for B or C. Its result still reports possession and signer authorization as false.

## INFERENCE — trust boundary

A passing equation does not establish that each listed participant signed or possesses its key. This controlled construction demonstrates why point validation and selecting a POP hash-to-curve tag do not discharge key-registration or proof-of-possession assumptions. It does not demonstrate an exploit against an authenticated Ethereum validator set. Trusted membership, relevant enrollment evidence, participant selection, consensus domain and state-transition rules require separate checks. A caller-supplied boolean asserting trust would not supply that evidence.

## Reproduce and next gate

From a clean checkout, install only the pinned isolated package using `npm --prefix experiments/bls-g1 ci --ignore-scripts --no-audit --no-fund`, then run `npm --prefix experiments/bls-g1 run test:aggregate`. The actual guarded commands and immutable-attempt policy are in [run-checks.py](../evidence/bls-aggregate-20261108/run-checks.py); it refuses to overwrite logs. For a fresh reproduction retain a new evidence directory rather than replacing published results. The [machine-readable record](../evidence/BLS_POP_AGGREGATE_20261108.json) contains hashes, inputs and exact execution commands.

IDEA — Next extend the existing ForkData work with pinned Ethereum consensus-domain and SigningData derivation vectors. Before committee-signature composition, separately specify authenticated participant selection and evidence for the key-enrollment/possession assumption. Preserve independent checkpoint provenance, real network/fork scheduling, freshness and update-transition gates. No self-selected root or provider count can close those gates.
