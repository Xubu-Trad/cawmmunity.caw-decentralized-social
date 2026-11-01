# C-016: owner-controlled cryptographic migration review

Status: proposed design constraints, 2026-11-01. No migration implementation, selected PQ algorithm, accepted specification change or production protection follows from this document. Read the [current inventory](QUANTUM_AI_RESILIENCE.md) and [source conflict C-016](../sources/SPEC_CONFLICTS.md#c-016).

## Decision to make

How can an account move to a reviewed authentication scheme without introducing a developer upgrade key, losing its history, or letting a former owner move the current owner's assets?

The current lab uses classical Ed25519. Ethereum experiments additionally depend on secp256k1 and underlying-chain security. Neither a new frontend nor a new verifier can independently replace the CAW token contract's authority or Ethereum consensus. A new deployment address is not proof that old balances moved safely.

## Candidate boundaries

| Candidate | What it could provide | Why it is not yet accepted |
| --- | --- | --- |
| Continue current immutable generation | Stable, inspectable behavior | Does not replace vulnerable authentication |
| Optional migration to a new immutable generation | Separate review of new code and explicit owner choice | Needs source-side asset semantics, replay protection, identity/history continuity and safe handling of concurrent ownership changes |
| Precommitted destination and new-key proof | Evidence recorded before a possible old-scheme failure | Commitment ordering/finality, update rights and revocation must themselves remain trustworthy; an old-key-only override defeats the commitment |
| Developer-controlled verifier upgrade or emergency recovery | Convenient centralized intervention | Conflicts with the no-special-developer-authority requirement; excluded from this proposal |

IDEA — Investigate the second and third options together. This is not a decision to implement them. No timer, fee, quorum or mandatory migration deadline is selected here.

## Proposed invariants

These are review requirements, not claims about existing executable code.

1. **Current ownership:** an NFT transfer invalidates any former owner's pending migration authority. Bind source account, current ownership epoch and source generation. Specify the ordering of transfer, withdrawal and migration at one canonical chain state.
2. **Destination control:** prove control of the intended destination key and bind its scheme, version and exact key bytes. A key or address copied from an untrusted packet cannot establish authority by itself.
3. **No silent substitution:** bind source/destination chain identities, deployment identities, account, epoch, action, nonce, validity window and both scheme identifiers. Domain separation must distinguish migration from posting, delegation, revocation and withdrawal.
4. **Single economic effect:** define precisely whether assets are transferred, locked or otherwise accounted for. No credit in both generations, replayed claim, partial debit with no recovery path, or acceptance based only on an off-chain migration receipt. Underlying assets outside the mechanism remain outside its protection.
5. **No weaker path:** where hybrid authorization is proposed, require both signatures over the same canonical statement. An old-signature-only recovery, fallback or contract-wallet branch would bypass that requirement. Review all paths, not just the main entrypoint.
6. **Independent reconstruction:** another operator must reconstruct the migration status from public evidence and explicit finality assumptions. No original server, Xubu approval, private database or repository availability may determine ownership.
7. **Bounded verification:** define sizes and verification budgets before admitting a scheme. Invalid and oversized inputs must not trigger unbounded allocation, automatic downloads or retries through another algorithm.

## Threat scenarios and required evidence

| ID | Scenario | Required decision or negative case |
| --- | --- | --- |
| MIG-01 | Owner prepares migration, then transfers the NFT | Former owner's prepared authorization must not move the new owner's assets; test both transaction orderings |
| MIG-02 | Attacker substitutes a destination or scheme | Both destination-control proof and source authorization must fail on each changed bound field |
| MIG-03 | One hybrid signature is absent, invalid or unavailable | Reject without state change; no classical-only fallback |
| MIG-04 | Same authorization appears on another chain, deployment or generation | Reject even when account names, addresses or nonces coincide |
| MIG-05 | Concurrent claims, withdrawal, or callback during settlement | At most one economic effect; preserve conservation and owner withdrawal rights under explicitly agreed semantics |
| MIG-06 | Reorg removes preparation or settlement | Reconstruct canonical status; an orphaned observation cannot create permanent destination credit |
| MIG-07 | Old signature scheme has already become forgeable | Do not accept old signatures as proof of the rightful owner. Specify trusted pre-break evidence or explicitly state recovery is unavailable |
| MIG-08 | Attacker replaces or cancels a precommitment with a forged old signature | Do not claim protection unless update/cancellation rules prevent this bypass under the declared threat model |
| MIG-09 | Destination key is lost or a user never opted in | Document consequences and any recovery authority; no hidden developer override or promise that everyone can be rescued |
| MIG-10 | PQ signature is large or costly; verifier throws | Bound resources and reject without partial state changes or downgrade |
| MIG-11 | Base chain consensus or underlying token ownership is compromised | State the mechanism's dependency limit; application authentication alone cannot establish asset safety |
| MIG-12 | Original builder, frontend, relay and hosted API disappear | Reproduce preparation, submission and status reconstruction from independently retained public code/data |

## Questions for peer review

- Does migration preserve an NFT identity or create a linked new identity, and what exact source-side operation makes the destination claim exclusive?
- Is this a same-chain mechanism only? Cross-chain atomicity and finality require a separate design; they must not be inferred from matching signatures.
- Which independently verifiable evidence establishes that a commitment predates a signature compromise? Wall-clock dates or GitHub publication alone do not do so.
- Can current owners change or cancel commitments without reopening an old-key bypass? What happens on transfer and loss?
- Which protections remain meaningful when only application signatures fail, versus when the base chain fails?

Before executable protocol changes: record alternatives and objections, resolve the source interpretation, select reviewed standards/implementations with authoritative vectors, and specify the complete state machine. Then implement the listed negative cases against that state machine and obtain independent review. A checklist or synthetic policy model passing tests would not demonstrate a secure migration.

Existing public-test and production blocks remain. Native-account replay investigation is separate and unresolved; hosted CI remains deferred. This review adds no test passes to the previously recorded 1,248-test suite.
