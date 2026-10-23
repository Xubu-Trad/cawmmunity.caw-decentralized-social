# Current gates

Initial review: [alpha.20 at `91479b6dc8c9a264411d75177d43029e0266c354`](REVIEW_BASELINE.md). State recorded 2026-09-20. This is an evidence checklist, not a completion estimate.

| Gate | Current state | Evidence needed next |
| --- | --- | --- |
| Public review | Baseline published; outside reproduction and agreement open | Reproducible findings, objections and a documented review/acceptance process |
| Settlement safety | [72 integrated regression cases](PAID_ACTION_REGRESSION.md) passed in isolation; broader coverage, review and delegated-wallet execution remain open | [Callback regression #2](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/issues/2), [wallet compatibility #6](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/issues/6) |
| Independent recovery | Selected-history reconstruction, rollback and restart demonstrated locally; [header checks](HEADER_CHECKED_RECOVERY.md) precede adoption and the explicit [checked action mode](HEADER_CHECKED_ACTIONS.md) gates current observations. [Checked provider comparison](HEADER_CHECKED_PROVIDERS.md) requires those checks for every report before full-history agreement; it remains offline. [Receipt roots](BLOCK_RECEIPT_COMMITMENTS.md) and [complete transaction bytes with receipt association](BLOCK_TRANSACTION_COMMITMENTS.md) are checked separately against selected headers. | [Genuinely signed local bodies now pass the unchanged byte/hash/commitment checks on both branches](SIGNED_BODY_ACQUISITION.md); the earlier impersonated captures remain rejected. [Offline sender recovery now checks signature bytes and the selected chain policy](BLOCK_SENDER_VERIFICATION.md). [History fields now bind to checked bodies and recovered senders](PAID_BODY_HISTORY.md). [Successful post signatures now match historical owners under explicit ordinary-account assumptions](PAID_POST_SIGNATURES.md). [Registry permission rules now check direct calls against recovered senders and reconstructed approvals](PAID_REGISTRY_PERMISSIONS.md). Authenticated code/state, callback and contract-wallet execution, endpoint authentication, adoption integration, confirmation policy and independent acquisition remain open: [acquisition #3](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/issues/3), [reorg reconstruction #4](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/issues/4). |
| Specification and scale | Registration, economics and text rules unresolved | [C-001 registration #1](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/issues/1), [staking/distribution #5](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/issues/5), [submission/relay costs #7](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/issues/7), [420-character rule #8](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/issues/8) |
| Input and privacy | [Bounded browser input admission](INPUT_BOUNDARY.md) and [documented exposure boundaries](PRIVACY_BOUNDARY.md); no encrypted DM or anonymous transport | Review metadata, DM transfer/key retention, remote hosting policy and independent parser cases before connecting transport |
| Public test candidate | Blocked | Review the preceding evidence, document relevant decisions/deviations, pin a new candidate and approve a bounded test plan with explicit failure criteria |
| Production | Blocked | Resolve remaining [source conflicts](../sources/SPEC_CONFLICTS.md) and satisfy the full [protocol scope](PROTOCOL_V0_SCOPE.md), authority/dependency, availability, security and peer-review gates |

First contributions: [Unicode examples #9](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/issues/9) and [clean offline-reader reproduction #10](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/issues/10). These gather evidence; they do not decide protocol rules.

Labels identify the work: `review` for evidence and objections, `protocol` for behavior, `security` for adversarial properties, `reproduction` for repeatable results, `spec-decision` for unresolved source choices, and `good first issue` for bounded entry tasks. An issue closes on its stated acceptance evidence, with any source decision recorded separately. None of the ten issues being opened establishes acceptance or authorizes deployment.


## Active engineering slice — 2026-10-22

Resume from alpha.46 with the [operator-independence register](OPERATOR_INDEPENDENCE.md), extending the existing OUT-08 recovery plan. First define and implement a bounded offline recovery-bundle check using existing readers and explicit trust assumptions. The new register records nine open dependencies and the negative cases needed before an original-operator-absent result can be claimed. This documentation adds no new test passes or production capability; the public test candidate and production remain blocked.


### Recovery checker evidence

The [bounded offline checker](RECOVERY_BUNDLE.md) now reuses existing readers against a separately retained selection, with 14 focused checks and 1061/1061 full offline regressions. A separate CLI run recovered from fresh files and a fresh working directory. It proves conditional fixture reconstruction only. Next: review an independently supplied package and explicit trust selection; do not promote it to authenticated acquisition, real account authority or automatic adoption. See [the exact scope and source hashes](../evidence/RECOVERY_BUNDLE_TEST_RESULTS.json).


### Retained selection boundary

The recovery command now requires a separately retained selection SHA-256. Replacing both the package and its selection fails against the original digest. This does not authenticate whoever supplied the digest or the selected chain. [21 focused checks and 1068 full regressions](../evidence/RECOVERY_SELECTION_PIN_TEST_RESULTS.json) passed; earlier 14/1061 results above remain historical. Independently supplied evidence and an authenticated trust-bootstrap design remain next, with no automatic state adoption.


### Public recovery trust gate

[Recovery trust model](RECOVERY_TRUST_MODEL.md) separates acquisition, retained byte integrity, anchor authentication, operator independence and account authority. Select and review an explicit chain/fork profile and anchor trust model before broadening the synthetic reader. This is a proposed evidence sequence, not an executed public-network recovery or a resolved specification decision.


### Static frontend recovery

The [copied-build checker](STATIC_RECOVERY.md) now checks a fixed asset set against a separately retained manifest digest, rejecting missing, changed and extra files. Twelve focused checks, a separate CLI invocation, the static build, and 1080/1080 offline regressions passed. This is same-machine byte verification, not a second builder reproduction or hosted-response check. OI-01 remains open; public recovery and protocol gates are unchanged.


### Portable static packaging

[Deterministic packaging](STATIC_RECOVERY.md#reproducible-portable-archive) now emits only the fixed frontend asset set, with constant archive metadata. Python tar interoperability and 1081 offline regressions passed. Independent builder distribution/reproduction and hosted-response verification remain open; this archive does not include or certify a protocol deployment.


### Replacement-host evidence

[Fresh-directory loopback hosting](STATIC_RECOVERY.md#replacement-host-experiment) now checks served bytes and relocated asset links, including a corrupt-host negative case. Independent builder/host reproduction and browser execution remain open. Further same-machine frontend tests cannot close the independence gate. Return primary implementation attention to the existing protocol authority and public-history trust requirements while seeking independent reproduction.


### Selected-header state-proof binding

[Header-bound state proofs](HEADER_BOUND_STATE_PROOF.md) now derive the proof root from the recomputed selected header, preventing an unrelated root override. Ten focused checks and 1094 offline regressions passed. Retained PublicNode proof unavailability remains a negative case. Canonical chain selection, acquisition independence, registry ownership and execution remain separate open gates; no current recovery acceptance flag changes.


### Selected-state code identity

[Runtime-code binding](HEADER_BOUND_STATE_PROOF.md#optional-runtime-code-binding) now compares supplied bytes with both the selected-header account commitment and a separately retained expected hash. Eight focused checks and 1102 offline regressions passed. Registry storage/ownership interpretation, dependencies, authenticated anchors and execution remain unresolved; matching code bytes does not grant permission or production acceptance.


### Registry layout prerequisite

[Compiler-derived registry layout](REGISTRY_STORAGE_LAYOUT.md) reproduced the fixture runtime, creation bytes and ABI exactly. Two focused provenance/type checks and a mutated-layout rejection passed. No full-suite rerun or new ownership proof is claimed. Next: concrete mapping-key derivation and selected-state storage evidence, preserving the difference between post-state ownership and transaction-time permission.


### Fixed-registry state decoding

[Owner/epoch proof decoding](REGISTRY_STATE_PROOFS.md) derives exact mapping keys and checks witnesses against the selected header and fixture code. Twelve focused checks and 1116 full regressions passed on constructed states. Executed-fixture proof acquisition, transition/transaction timing and approvals remain next. This decoder does not grant live permission or widen production acceptance.


### Executed registry acquisition

[Two local executed owner/epoch states](EXECUTED_REGISTRY_STATE.md) now match their header-bound proofs and direct contract reads. Six additional checks bring offline coverage to 1122 tests. Next: transaction-position and approval scope; neither public acquisition nor live permission adoption is established.


### Replay/state reconciliation boundary

[Registry replay/state reconciliation](REGISTRY_STATE_RECONCILIATION.md) now compares the selected owner/epoch proof with replay from explicit constructor assumptions. Ten new tests bring offline coverage to 1132. A synthetic operator-grant counterexample demonstrates that matching owner/epoch cannot prove approval state or transcript completeness. Next: complete ordered transaction/receipt binding and approval-state coverage; no authority or adoption gate is closed.


### Selected approval state

[Four-witness approval decoding](REGISTRY_APPROVAL_STATE.md) now proves the token approval and one current-owner operator pair, with six locally executed states and 1144 offline tests. Transaction-position authority and complete-history binding remain unresolved. Compose with the existing signed-history reader at a matched endpoint next; do not infer earlier permission from final state.


### Signed-history endpoint reconciliation

[Signed registry history plus selected approval state](REGISTRY_HISTORY_STATE.md) now requires a matching checked endpoint and replayed owner/epoch/approval/operator values. Eight integration checks and 1152 regressions pass on explicitly constructed endpoints. Next: one executed signed-body capture with its own state proofs; current separate captures cannot satisfy that evidence gate. No production or execution acceptance is added.


### Executed joint signed-state evidence

[Joint local acquisition](JOINT_SIGNED_STATE_ACQUISITION.md) now binds two executed branch histories to their own endpoint proofs: six Node checks, six Python scope tests, 1158 full Node regressions. The local joint-capture gap is closed for zero-approval endpoints. Next: signed grant/revocation coverage and public/independent anchor authority. Production, consensus and execution acceptance remain blocked.


### Signed grant/revocation endpoints

[Signed approval acquisition](SIGNED_APPROVAL_ACQUISITION.md) verifies positive and revoked selected grants with original endpoint proofs in two local branches; seven new checks and 1165 full regressions pass. Transfers remain owner-authorized in this experiment. Next isolate delegated transfer paths and rejected revoked delegates; keep transfer permission separate from spending/withdrawal authority.


### Signed delegated transfer evidence

[Isolated delegated transfers](SIGNED_DELEGATE_ACQUISITION.md) pass for token approval and operator grants; revoked attempts fail locally with signed failed receipts. Eight new cases and 1173 regressions pass. Next reconcile spending/withdrawal negatives with existing custody evidence. Do not interpret NFT transfer grants as account spending powers or public-chain authority.


### Signed withdrawal boundary

[Transfer permission versus withdrawal](SIGNED_WITHDRAWAL_ACQUISITION.md): both signed non-owner withdrawal attempts fail while isolated transfer permissions remain valid. Five new checks; 1178/1178 full suite. Next reconcile paid-action signature and contract-wallet evidence. This does not prevent an authorized transfer delegate from becoming the owner.


### Wallet execution evidence gate

[Wallet authority review](WALLET_AUTHORITY_EVIDENCE_REVIEW.md) reconciles existing signature, contract callback and withdrawal coverage. Next: isolate wallet state sensitivity using fixed signed intent and signed configuration changes, then separately design transaction-position replay. Endpoint code proofs cannot upgrade historical wallet authority; type-4 transactions remain unsupported.


### Wallet state sensitivity observed

[Fixed signed-post experiment](WALLET_STATE_EXPERIMENT.md): local valid/rejected/restored outcomes with unchanged intent and accounting. Five new checks; 1183/1183 full suite. Next: transaction-position execution witness; stable latest-header observations are not that proof.


### First transaction replay anchor

[Parent/body binding](FIRST_TRANSACTION_ANCHOR.md) now validates a selected first transaction and parent-state commitment. Eight new checks;1191/1191 suite. It does not prove pre-transaction state or execute system/transaction transitions. Next: dependency proofs and explicit fork-aware replay.
