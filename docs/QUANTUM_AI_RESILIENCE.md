# Quantum and AI-assisted attack resilience

Status: 2026-11-01. This is a threat inventory, regression evidence and open design gates. The alpha has **no implemented post-quantum account authentication** and is not production-ready. No claim of immunity to quantum computers, advanced AI or compromised clients is made.

## Evidence and assumptions

FACT — [NIST standardized ML-KEM, ML-DSA and SLH-DSA in 2024](https://www.nist.gov/news-events/2024/08/announcing-approval-three-federal-information-processing-standards-fips). ML-KEM is key establishment, not a transaction-signature replacement. [FIPS 204](https://csrc.nist.gov/pubs/fips/204/final) specifies ML-DSA signatures. [IR 8547](https://csrc.nist.gov/pubs/ir/8547/final) is now a final migration report; its existence does not establish CAW compliance or a deployment deadline for this project.

FACT — Ethereum's [security roadmap](https://ethereum.org/roadmap/security/) identifies quantum exposure beyond account signatures, including consensus and other cryptographic dependencies. A different frontend signature cannot upgrade those dependencies or the underlying token's authority rules.

FACT — [Anthropic's smart-contract research](https://www.anthropic.com/research/smart-contracts) demonstrates AI-assisted exploitation in blockchain simulations. It supports treating software vulnerabilities as an immediate engineering concern; it is not evidence of breaking ECDSA's mathematical assumptions. Its simulated proceeds must not be described as live theft.

INFERENCE — We should prepare for replacement of vulnerable primitives without forecasting a particular year for a cryptographically relevant quantum computer. Shor threatens elliptic-curve signatures; quantum hash search also matters, but hashes, signatures, preimage resistance and collision resistance have different security properties. A hash commitment alone does not authenticate an owner.

UNRESOLVED — The supplied commentary's precise hardware counts, runtimes, market exposure percentages and predictions about AI mathematical breakthroughs were not established by this review and are not design assumptions.

## Current cryptographic and authority inventory

| Surface | Current mechanism and exposure | Existing boundary | Remaining requirement |
| --- | --- | --- | --- |
| `public/signatures.mjs` | Ed25519 local signing; public key accompanies packets; not post-quantum | Fixed action schema, domain/account/epoch/nonce/time binding, separate trusted key, no algorithm fallback | Reviewed versioned migration protocol; this lab is not wallet settlement |
| `public/owner-grant.mjs`, `public/delegation.mjs`, `public/signed-ledger.mjs` | Ed25519 owner and delegate; SHA-256 grant binding | Owner consent, finite delegation scope/budget/time, replay and transfer controls | Two classical keys are not a classical/PQ hybrid; root-key compromise defeats delegated limits |
| `reference/ethereum-block-senders.mjs`, `reference/paid-post-signatures.mjs`, paid-action experiments | Ethereum secp256k1 transaction/action authentication; experimental contract-wallet paths | Chain/domain and historical permission checks with stated assumptions | EIP-1271 compatibility alone does not establish post-quantum security; inspect every owner/recovery path |
| Recovery and evidence readers | SHA-256/Keccak commitments and selected chain evidence | Bounded input and explicit trust selection; matching a hash is not publisher authentication | Track hash security, chain consensus, proof systems and external trust anchors separately |
| Private messages | No production encrypted DM implementation | No confidentiality promise | Address harvest-now/decrypt-later, authenticated key establishment, forward secrecy, transfer/recovery and metadata; do not invent a cipher |
| Delivery and dependencies | Browser/runtime, packages, hosting, RPC, release artifacts and underlying chains | Pinned/bounded local experiments; operator-independence work remains open | Complete authority/dependency graph and reproducible distribution; a secure signature cannot rescue a compromised signer or malicious UI |

## Measures applied in this increment

Five fault-injection tests exercise the existing fail-closed behavior:

- `tests/signatures.test.mjs`: native `importKey` and `verify` failures reject the action without advancing its nonce or selecting a fallback. After the provider is restored, the original packet is accepted once and a replay is rejected.
- `tests/owner-grant.test.mjs`: native `importKey`, `verify` and `digest` failures leave the full observed ledger/export/budget state unchanged. After restoration, the same authorized packet consumes the expected fee once.

Reproduce focused checks with Node 24.20.0:

```sh
node --max-old-space-size=256 --test --test-isolation=none --test-concurrency=1 --test-timeout=30000 tests/signatures.test.mjs tests/owner-grant.test.mjs
```

Result: 49/49 focused tests; 1,248/1,248 full offline tests across 73 files. [Recorded result and source hashes](../evidence/CRYPTO_RESILIENCE_20261101.json). These are synthetic local tests, not a cryptographic audit. They do not prove resilience against a provider that lies about verification, a compromised operating system, stolen keys, every asynchronous failure or live-chain attacks. No production algorithm was changed.

## AI-assisted attack controls

AI tools must not receive deployment/owner secrets or autonomous spending, withdrawal, migration or approval authority. Repository comments, retrieved pages, community posts and supplied artifacts are untrusted input, not authorization to execute their instructions. Use isolated synthetic environments and retain failed cases; review generated patches against independently stated invariants.

The security test priorities remain authorization and signature binding, replay/reorg behavior, balance conservation, callback/reentrancy safety, withdrawal ordering, malformed and oversized input, poisoned acquisition providers, dependency identity and recovery without an operator. AI-assisted review supplements independent review; it does not certify its own output. Formal verification must name the property, model and assumptions it proves.

Session expiry and spending limits reduce delegated exposure. They cannot protect funds when an attacker can forge the root owner's signature. Nonextractable browser keys can still be used by malicious code in the signing context. Monitoring must never imply a developer pause key or privileged rescue authority.

## Open migration gates — C-016

IDEA — Evaluate reviewed standardized signature implementations and an owner-controlled, versioned migration to a separately reviewed immutable generation. This is a proposal, not an accepted protocol change or selected algorithm.

Before implementation or a post-quantum claim:

1. Specify which accounts, balances, NFTs, history, transports and underlying chains are protected, and identify every remaining classical authentication or recovery path.
2. Define owner consent and continuity without a developer/admin upgrade key. Decide how precommitted destinations, lost keys, NFT transfers and old generations behave. Once an old scheme is broken, a signature under that scheme cannot distinguish its legitimate owner from an attacker; late migration alone is not a recovery solution.
3. If a hybrid is chosen, require **both** reviewed signatures over the same canonical action and scheme/version/domain/chain/account/epoch context. Never implement an OR fallback or silent downgrade. Establish this design's security assumptions independently.
4. Measure signature/key size, verification cost, gas and denial-of-service bounds. The current 64-byte signature and packet bounds are deliberate lab constraints; do not merely increase them to fit a new algorithm.
5. Use authoritative test vectors, malformed-signature cases, algorithm-confusion/downgrade tests, migration/transfer/replay tests and independent cryptographic review. Retain classical negative cases and failed experiments.
6. Demonstrate acquisition, deployment and recovery by another builder with no original operator or privileged key. Resolve the source interpretation publicly before a release decision.

Key rotation and fresh addresses are not complete quantum defenses. Do not market the project as quantum-safe because a wallet or one application path adopts a PQ signature while the base chain, token or recovery path remains exposed.

Public-test and production gates remain blocked. Existing native-account replay and other roadmap blockers remain unchanged; this work adds security evidence and migration requirements rather than declaring them resolved.
