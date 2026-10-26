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


### Selected replay dependencies

[Account/storage/code proof bundle](REPLAY_DEPENDENCIES.md) verifies declared dependencies at one header. Nine new checks;1200/1200 suite. Completeness, parent/child composition and execution remain open.


### Exact replay input binding

[Parent/dependency composition](REPLAY_INPUT_BINDING.md) rejects valid proofs from another branch. Six new cases;1206/1206 suite. Positive fixture has a synthetic child, not a valid execution claim. Next: fail-closed state access, then fork-aware replay.


### Read-only witness access

[Witness-state access](WITNESS_STATE.md) rejects missing accounts and unselected slots without RPC or zero fallback. Nine focused cases and 1215/1215 offline tests passed. Next: fork-aware execution and system transitions, with missing reads propagated as failure. This read interface does not establish dependency completeness or wallet authority.


### Execution adapter integration gate

[Source review and experiment plan](EXECUTION_ADAPTER_REVIEW.md) identifies missing-state defaults that must not replace missing witness evidence. Next: pin a released engine and dependency set, implement journaled proof-backed access with permanent failure on missing evidence, and acquire a genuine executable first-transaction fixture. No engine has been installed or replay validated; 1215/1215 remains the prior offline result.


### Permanent replay read failure

[Read-session safeguard](REPLAY_READ_SESSION.md) keeps missing-evidence failure outside any future reversible journal. Six new cases and1221/1221 offline tests pass. Five direct engine candidates are archive-pinned; transitive lock, installation and engine integration remain open.


### Released-engine read probe

[Three engine boundary checks](ENGINE_READ_BOUNDARY.md) passed with a frozen17-package graph and scripts disabled. Injected SLOAD reads proven state and rejects missing evidence. Signed replay and nested rollback remain unproved. Next: nested-call propagation, then bounded write journaling. Existing1221 offline checks remain a separate historical result.


### Nested engine failure propagation

[Three DELEGATECALL checks](ENGINE_NESTED_READ.md) distinguish an ordinary caught revert from missing-witness failure. Session failure survives an explicit state-manager revert. Injected bytecode only; no write rollback or signed transaction replay proof. Next: bounded mutable overlay over immutable proof-backed state.


### Bounded storage overlay

[Selected-slot write overlay](REPLAY_STORAGE_OVERLAY.md) preserves original values and supports nested commit/revert without clearing evidence failure. Eleven focused cases and1232/1232 offline checks pass. Next engine SSTORE integration; account/code journaling and signed replay remain open.


### Engine storage-write integration

[Four injected SSTORE checks](ENGINE_STORAGE_WRITE.md) cover child commit/revert, explicitly harnessed parent rollback and permanent missing-evidence failure after a write. No gas-accounting or signed replay proof. Next account journaling and transaction-level integration.


### Existing-account journal

[Nonce/balance overlay](REPLAY_ACCOUNT_OVERLAY.md) shares rollback with storage. Nine new cases;1241/1241 offline suite and four existing engine storage checks passed. Engine account writes and signed replay remain next. Returned proof hashes are original commitments, not updated state roots.


### Engine existing-account callback

[Nine account callback checks](ENGINE_ACCOUNT_WRITE.md) passed, including paired storage/account rollback and six unsupported changes. Zero-value self CALL invoked two real engine account writes; no value-transfer or signed replay proof. Next genuine signed fixture and transaction-runner integration with all validity checks enabled.


### Signed local transaction fixture

[Signed transfer acquisition](SIGNED_TRANSFER_FIXTURE.md) now supplies three-account parent/child proofs and a verified receipt. Three grouped checks pass; no independent execution replay yet. Next connect runTx without nonce/balance bypass and compare acquired child state.


### Signed local transfer execution

[Three bounded engine replay cases](ENGINE_TRANSFER_REPLAY.md) passed: acquired account/receipt comparison and nonce/balance rejection without bypasses. No full post-state-root or public-chain proof. Next missing-witness failure during transaction execution and acquired contract execution.


### Missing-witness transaction failure

[Seven bounded cases](ENGINE_MISSING_WITNESS_REPLAY.md) include missing sender/recipient/fee-recipient rejection and permanent attempt invalidation after rollback. Next acquired signed contract execution and missing-slot checks; no production acceptance.


### Signed synthetic contract call

[Four bounded cases](ENGINE_CONTRACT_REPLAY.md) match captured account, storage and receipt evidence and reject missing storage. Runtime/storage were locally seeded; no deployment or public-chain proof. Next acquired execution-revert comparison.


### Signed execution-revert comparison

[Four bounded revert cases](ENGINE_REVERT_REPLAY.md) confirm a write is rolled back while nonce and gas effects persist. Missing evidence remains a fatal attempt error. Next isolate successful storage-clearing refund accounting; no production acceptance.


### Signed storage-clear refund comparison

[Four bounded storage-clear cases](ENGINE_CLEAR_REPLAY.md) match a4800 refund and21206 net gas against captured receipts/accounts. Refund cap not binding; capped-refund evidence is next. No production acceptance.


### Signed binding refund-cap comparison

[Four bounded cap cases](ENGINE_CAP_REPLAY.md) match a9600 counter capped to6202 and24810 charged gas. Missing second-slot evidence fails after the first write. Next shared adapter review; no production acceptance.


### Shared bounded witness adapter

[34 grouped checks](SHARED_WITNESS_ADAPTER.md) pass through a shared experimental adapter. Stronger tests found and fixed storage access after unsupported-operation failure. Next complete interface/lifecycle review; no production acceptance.


### Isolated witness adapter interface

[39 grouped checks](SHARED_WITNESS_ADAPTER.md) pass with an explicit frozen callback interface and no inherited cache stacks. Next callback edge cases and diagnostic bounds; no production acceptance.


### Bounded witness adapter callbacks

[49 grouped checks](SHARED_WITNESS_ADAPTER.md) pass with strict callback input checks and a256-record per-attempt diagnostic budget. This is an experiment limit, not a protocol rule. No production acceptance.


### Witness adapter interface and review gates

[51 grouped checks and interface inventory](SHARED_WITNESS_ADAPTER.md) include a4096 shared callback budget with cleanup allowed after exhaustion. Full state roots, arbitrary execution and public-chain trust remain blocked.


### Structured local replay outcomes

[59 grouped checks](REPLAY_OUTCOMES.md) distinguish execution revert from missing evidence, unsupported operations and local limits. Attempts close after reporting; state comparison and production flags stay false. Next explicit input/engine provenance binding.


### Replay input/source provenance

[63 grouped checks](BOUND_REPLAY_PROVENANCE.md) bind exact input and selected local source hashes. Installed engine and public chain are not attested. Next complete source manifest and pre-execution verification.


### Expected source manifest gate

[66 grouped checks](MANIFEST_REPLAY_GATE.md) verify21 local files against an explicitly selected manifest before replay. Installed dependencies/runtime and public chain remain unattested.


### Installed engine package payloads

[17 pinned archive comparisons](INSTALLED_PACKAGE_COMPARISON.md) match installed payloads; generated launchers remain separately unverified. Next dependency-resolution links and runtime identity. No full-installation attestation.


### Declared links and runtime checksum

[61 declared links and the exact runtime checksum](LINKS_RUNTIME_COMPARISON.md) match. Conditional imports, loaded modules and the release signature remain unverified.


### Selected entrypoints and current README -- 2026-10-26

[12 selected default-mode resolutions](ENTRYPOINT_OBSERVATION.md) agree with the pinned export paths; separate ESM/CommonJS Address identities reproduced. This is not a full transitive loader proof. Next compare a single-mode signed replay harness against retained outcomes before changing existing imports. README now introduces the project and indexes current evidence with separate counts and unresolved release gates. Keep that summary current with each engineering publication.


### ESM replay comparison -- 2026-10-26

[The tx/block ESM variant](ESM_REPLAY_COMPARISON.md) passes the same66groups and emits eight unchanged result records relative to the retained mixed-mode run. Original harnesses preserved. No complete-loader or full-state-root proof. Next explicitly bind executor/harness identity; update README with each engineering publication.


### Selected executor gate -- 2026-10-26

[13 focused groups](SELECTED_EXECUTOR.md) exercise a fixed London executor and two-file source selection. No caller callback is accepted. Existing base manifest remains unchanged. File-URL/module-cache and cooperating-host assumptions remain explicit; next a fresh-process boundary. README updated; prior66/1241results not rerun.


### Fresh-process execution -- 2026-10-26

[Eight fresh processes](EXECUTOR_PROCESS.md) reproduce identical normal output and refuse bad selections/input or output overwrite. New CLI enforces bounded strict input and exclusive result creation. This is not immutable execution or crash-durable publication. Next strict result consumer bound to separately retained input/selections and successful process completion. README updated; prior suites not rerun.


### Local access -- 2026-10-26

[Local protocol and alpha access](LOCAL_ACCESS.md) documented; protocol:check exposes the selected-executor command.13groups rerun successfully from the local repo; loopback entrance HTTP200. No deployment or frontend/engine connection. Strict process-result consumer remains next.
