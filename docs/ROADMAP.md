# Engineering roadmap

## Implementation priority — November 8, 2026

Build one normally deployed local candidate before extending isolated research. The immediate review target is [the constructor lifecycle](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/pull/19), stacked on PR #18. The signed local-chain sequence now records26 transactions with raw bytes and receipts in draft PR #19. Next connect the existing independent readers and verify reconstruction against those exact records. Synthetic token/account limitations remain explicit.

Then resolve registration and reviewed economic semantics, implement open-population accounting and NFT/wallet authority, connect a replaceable frontend/relay beta, and satisfy security, operator-disappearance and public release-review gates. These are separate milestones; no completion percentage or adopted policy is implied. Existing evidence and unresolved gates follow.

# Current gates

## Active priority — 2026-11-01

[One independently reproducible public action](PUBLIC_ACTION_MILESTONE.md) is the next integrated milestone. Reconcile the asset/registration boundary and exact economics before freezing a candidate. Reuse existing evidence and issues; do not deploy the three-account probe unchanged or treat offline test counts as acceptance. Crypto migration stays under review, alongside core settlement and recovery work. The dated entries below preserve prior scoped results; they are not a current completion percentage.

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


### Result record inspection -- 2026-10-26

[28 checks](EXECUTOR_RESULT.md) validate schema and retained identities with a caller-supplied completion observation. Plausible forged gas deliberately remains unauthenticated. Next owned-process integration and stale/replaced output tests; no state adoption. README updated.


### Owned-process result inspection -- 2026-10-26

[Worker and inspector integration](OWNED_EXECUTOR.md) passed; nine transport cases reject stale request markers, changed output and unsuccessful completion. No state adoption or execution authentication. Next authority/dependency graph and independent reproduction review; stop treating further local wrappers as independence evidence.


### Authority/dependency reconciliation -- 2026-10-26

[12 known source surfaces](CURRENT_AUTHORITY_DEPENDENCIES.md) mapped against all9open independence gates. Separate frontend, fixed three-account paid probe and local replay engine. [Pinned independent reproduction handoff](INDEPENDENT_EXECUTOR_REVIEW.md) and NOT_RUN receipt prepared; no new tests/reviewer claims. Next OI-09 external reproduction and explicit OI-02/OI-04 design review, not more local wrappers as independence proof.


### Competing-anchor evidence -- 2026-10-26

[Six checks](ANCHOR_TRUST_BOUNDARY.md) reproduce separately valid selected branches without canonicality/finality. Anchor-policy alternatives documented without adoption. Next production registry/bootstrap trust review; independent executor reproduction remains open.


### Registry/bootstrap authority -- 2026-10-27

[Source review](REGISTRY_BOOTSTRAP_REVIEW.md) separates immutable runtime identity from constructor allocation and current ownership. Seven production evidence gates remain open. Next bounded experiment: unchanged registry deployments with different constructor owners, runtime comparison, separate paid-probe bindings and negative controls. No production policy selected; independent reproduction remains open.


### Registry bootstrap counterexample -- 2026-10-27

[11 local groups](REGISTRY_BOOTSTRAP_EXPERIMENT.md) pass: same runtime, distinct allocations, separate immutable probe bindings and rejection controls. Next reuse the existing registry proof reader to bind owner/epoch to selected code/state, with wrong-registry/root and competing-state negatives. Selection authority/finality and independent reproduction remain open.


### Registry address/state binding -- 2026-10-27

[13 groups](REGISTRY_BOOTSTRAP_STATE.md) pass with fresh local proofs and unchanged reader. Next reconcile paid-probe immutable registry selection with selected-state code evidence, rather than a direct-call-only binding. Production anchor/registry decisions and independent reproduction stay open.


### Selected paid-contract binding -- 2026-10-27

[17 groups](PAID_REGISTRY_CODE_BINDING.md) pass for a fixed-fixture code/state composition. Next inventory and reconcile existing paid-ledger/endpoint-state evidence against this binding before implementing duplicate checks. Balances, actual withdrawal safety, production anchor/registry decisions and independent reproduction remain open.


### Paid-ledger endpoint inventory and layout -- 2026-10-27

[Evidence boundary](PAID_LEDGER_STATE_BOUNDARY.md) distinguishes replay/getter comparison from registry proofs and paid code binding. Paid ledger storage proofs are not yet composed. Compiler-derived layout reproduced with identical runtime/creation/ABI;4verification cases pass. Next13-slot selected paid-ledger witness with nonzero-state cases; external token backing remains separate.


### Constructed paid-ledger proof decoder -- 2026-10-27

[18 groups](PAID_LEDGER_PROOFS.md) pass for13-slot proofs plus fixed code/registry binding and ledger invariants. Synthetic constructed states only; no executed funding or history reconciliation. Next executed nonzero local capture with exact endpoint/history comparison. External token backing remains separate.


### Executed synthetic-token ledger reconciliation -- 2026-10-27

[14 groups](EXECUTED_LEDGER_RECONCILIATION.md) pass for zero/nonzero/withdrawn local endpoints,13-slot proofs, fixed code binding and existing history replay. Synthetic token and impersonated actors; no body/sender/receipt-root or real-token backing claim. Next compose the existing stronger history verification and preserve branch/position boundaries.


### signed body / ledger follow-up -- 2026-10-28

[Boundary checks](BODY_LEDGER_BOUNDARY.md) reject unrelated captures. Next acquire signed transactions, full bodies/receipts and ledger proofs together at one endpoint, then verify the positive composition and altered endpoint/transaction/receipt cases. No joint-positive or release gate is closed by the nine boundary groups.


### joint signed capture completed within fixture scope -- 2026-10-28

[15 focused groups](SIGNED_LEDGER_RECONCILIATION.md) exercise both acquired branches and tampering cases. The preceding joint-capture task is complete only for the synthetic fixture. Next connect the selected-evidence result to existing anchor-selection/operator-independence requirements, retaining false canonicality, token-backing and production-authority claims.


### anchor decision review -- 2026-10-28

[AT-01 through AT-08](ANCHOR_DECISION_REVIEW.md) make the unresolved production anchor decision explicit. Existing signed-ledger evidence is selected consistency only. Seek a concrete profile/proposal and independent reproduction in established review lanes; do not add wrappers as independence proof or choose a developer-controlled fallback. No gate closed.


### mined contract-signature fixture -- 2026-10-28

[Two mined attempts / nine focused groups](MINED_WALLET_EXPERIMENT.md) extend the previous simulation-only mode experiment. Next acquire exact parent-state code/storage dependencies and independently replay the transaction; selected receipts alone do not authenticate wallet authority.


### parent-state wallet replay -- 2026-10-28

[Rejected path reproduced; success blocked](WALLET_WITNESS_REPLAY.md). Acquired parent/child dependencies now exist. Next narrow absent-account/precompile handling with explicit missing-proof and unsupported-write rejection, then replay retained success. No full-state-root or production acceptance.


### proven native absence -- 2026-10-28

[Opt-in native adapter](WALLET_NATIVE_REPLAY.md) reproduces both fixture outcomes and passes10boundary checks; original readers remain unchanged. Next review proof/argument boundaries and cleanup against child absence evidence. No general account creation, full root or production gate closure.


### native child-state blocker -- 2026-10-29

[Present-empty versus absent](NATIVE_CLEANUP_MISMATCH.md) blocks complete selected child agreement after restored success. Trace lifecycle/cleanup against pinned engines and fork semantics before extending authority claims. Eighteen boundary groups pass; adapter unchanged.


### lifecycle localization -- 2026-10-29

[Engine cleanup trace](NATIVE_ACCOUNT_LIFECYCLE.md) localizes the replay deletion; capture-side root cause remains unresolved. Next minimal native-call acquisition under the same pinned fork, separating direct/contract-mediated calls. No gate closure.


### minimal acquisition control -- 2026-10-29

[Direct native call](DIRECT_NATIVE_CONTROL.md) isolates the observed presence transition from CAW contract logic. Next independently replay this interval with all selected account dependencies; no root-cause or release gate closure.


### direct replay control -- 2026-10-29

[Minimal second-engine replay](DIRECT_NATIVE_REPLAY.md) retains the native existence mismatch. Next ordinary trie-backed state-manager control before assigning root cause. No complete state agreement or gate closure.


### adapter isolation -- 2026-10-29

[Standard trie control](DIRECT_TRIE_CONTROL.md) retains the discrepancy. Inspect pinned acquisition persistence, proof serialization and block transitions next; post-transaction root mismatch alone is not complete block verification.


### native leaf localization -- 2026-10-29

[One-leaf diagnostic](NATIVE_LEAF_CONTROL.md) matches the captured root only after an explicit temporary state change, then restores the original replay. Next inspect touched/empty-account commit semantics; no acceptance gate closes.


### commit-path hypothesis -- 2026-10-29

[Source chain](NATIVE_COMMIT_REVIEW.md) traced through Foundry and locked revm crates. Next reproduce touched-empty commit behavior or observe boundary flags before reporting a confirmed root cause. Preserve the unmodified local fixture and mismatch.


### database reproduction gate -- 2026-10-30

[Prepared Rust harness](../experiments/native-commit/README.md): run in a bounded compiler-equipped environment, retain both characterization/oracle logs, generate and review Cargo.lock, then rerun locked. Runtime Anvil account flags remain a separate open question. No acceptance change.


### contributor review — 2026-10-31

#12 and #13 are merged with authorship preserved. Combined model tests pass 22/22 on pinned Node 24.20.0 and match merged content; the subsequent full offline regression passed **1,243/1,243 tests across 73 files** on pinned Node 24.20.0. #11 and #14 revisions are now merged after focused positive and deliberately failing checks on November 1. #10 has a contributor follow-up distinguishing recorded and reconstructed commands; full external logs remain uninspected. Continue the native-state investigation; these documentation/reproduction contributions do not resolve #7/#8 or the execution discrepancy. No specification decision follows from these tests. Native-state mismatch remains open; Rust reproduction and hosted CI remain unexecuted/deferred.


### native call boundary — 2026-11-01

[The call-to-commit source path](NATIVE_CALL_TOUCH_PATH.md) identifies where to observe the native target's state and flags. Next reproduce the unmodified pinned build before tracing load, transfer, precompile completion, journal finalization, commit and block completion. Preserve any divergence; do not force replay agreement. Rust/CI execution remains pending and no release gate closes.


### Quantum and AI resilience — 2026-11-01

[Cryptographic inventory and migration gates](QUANTUM_AI_RESILIENCE.md) now identify classical-signature and underlying-chain exposure. Five provider-failure regression cases passed; the full offline suite passed **1,248/1,248 across 73 files**. [Evidence](../evidence/CRYPTO_RESILIENCE_20261101.json). Next: independently review C-016 owner-controlled migration, hybrid/downgrade rules, signature resource bounds and remaining authority paths. No PQ scheme is implemented or selected. Existing native-account replay, public-test, CI and production gates remain unchanged.


### Owner-controlled migration review — 2026-11-01

The [owner-controlled migration review](CRYPTO_MIGRATION_REVIEW.md) now defines seven proposed invariants and twelve threat cases covering transfers, double claims, compromised old keys, recovery and underlying-chain failures. [Issue #15](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/issues/15) requests specification review before implementation. This is design work; the last executed suite remains 1,248/1,248 and no new runtime result or release readiness is claimed.


### Native replay runtime boundary — 2026-11-01

A new [native-account runtime trace](NATIVE_RUNTIME_TRACE.md) observes an empty-account write followed by deletion in the replay engine. An uninstrumented control matches its receipt, gas and root. The captured node still retains the empty account: the discrepancy is narrowed, not resolved. This standalone experiment adds no passes to the 1,248-test suite; acquisition-side runtime observation and deferred Rust/CI work remain open.


### Replay cleanup attribution — 2026-11-01

The [replay cleanup follow-up](NATIVE_RUNTIME_TRACE.md#follow-up-cleanup-caller-observed) now attributes native-account deletion to `Journal.cleanup`, with two executed source files checked against retained package archives. The controlled result remains unchanged and is consistent with EIP-161 cleanup for this case. Acquisition-side runtime attribution is still missing; this is not a fix or production-readiness result.


### Recovery admission ordering — 2026-11-01

The [offline recovery checker](RECOVERY_BUNDLE.md#selection-first-directory-admission--2026-11-01) now verifies the retained selection digest before opening received bundle files. Three new regression cases pass; the full offline suite passes **1,251/1,251 across 73 files** ([evidence](../evidence/RECOVERY_ADMISSION_RESULTS.json)). This improves admission order without changing trust assumptions. Native acquisition-side reproduction remains pending; no Rust compiler was found locally and hosted CI remains deferred.


### Candidate asset and economic terms — 2026-11-02

[Decision packet](CANDIDATE_TERMS_REVIEW.md) maps current code to open asset/registration, exclusion, snapshot, dust, submission and text choices. Exact integer examples and an intentionally failing dust check are retained. Review continues in existing issues #1/#5/#7/#8; no synthetic asset, burn workaround or scalable design is selected. No new EVM/full-suite/public deployment result is claimed. Next resolve an explicit provisional action profile before implementing a replacement for the three-account probe.


### Reward accumulator feasibility — 2026-11-02

The [staking accumulator comparison](STAKING_ACCUMULATOR_REVIEW.md) now tests account-excluding reward arithmetic against a per-recipient model. It also exposes values beyond 256 bits and a payout difference from moving rounding to claim time. This is research evidence for issue #5, not deployable settlement; integer bounds and rounding remain unresolved. The 1,251-test Node-suite count is unchanged.


### Fixed-point reward research — 2026-11-02

The [bounded-integer reward experiment](STAKING_FIXED_REVIEW.md) now preserves fractional claims and matches a per-recipient reference across four finite operation sequences. A deliberately broken fraction-retention variant fails. Precision, dust disposition and lifetime caps remain unresolved; this is not a deployed staking contract or a selected economic rule. Next review the precision/error budget and long-lived index strategy before implementing settlement. The 1,251-test Node count is unchanged; no release gate closes.


## Builder-absent rehearsal — 2026-11-03

Community engineering has resumed with a [builder-absent rehearsal plan](BUILDER_ABSENT_REHEARSAL.md): eight explicit loss scenarios, successor inputs and scoped acceptance/refusal criteria. Retained-fixture portability can be reviewed now; the integrated public action still requires candidate asset, economics and authority decisions. No new test passes or recovery completion are claimed.


## Retained-fixture portability — 2026-11-03

The [portable recovery exporter](PORTABLE_RECOVERY_FIXTURE.md) packages the existing reader and pinned synthetic fixture. Four Python export checks and the separate-directory reader passed; three negative copies reject. BA-01 now has an executable handoff package, but independent operator execution remains NOT_RUN. No asset, economic, authority or release decision changed. Next: obtain a separately selected second-builder receipt while resolving the integrated candidate's existing specification gates.


## Recovery CLI linked-path correction — 2026-11-03

Fixed a reproduced empty-success launch through a Windows directory junction. The CLI now resolves both entry paths;25focused tests and guarded positive/negative CLI checks pass, with the original failure preserved. A corrected portable export also ran successfully. [Evidence and limits](RECOVERY_BUNDLE.md#linked-entry-paths--2026-11-03). This closes a bounded reader-startup defect only: independent acquisition, BA-01 outside execution and integrated-action decisions remain open. The full-suite total is the previous run.


## Authorization lifetime and reviewer follow-up — 2026-11-05

[Current review](AUTHORIZATION_LIFETIME_REVIEW.md) records outside receipts and unresolved stake/delegate revocation semantics. A retained-history commitment regression passes with 13 focused checks. Next obtain reproducible outside evidence and settle explicit cancellation semantics before changing the candidate. No new EVM/full-suite/release claim; CI remains deferred.


## Reward precision and lifetime budget — 2026-11-05

[Analytical budget](STAKING_BUDGET_REVIEW.md) exposes the fixed-point model's stake-dependent index ceiling and separate funded-counter limit. Five Python tests pass, including an injected near-cap rejection. Next review a permissionless entitlement-preserving lifetime strategy and dust policy; no rollover, minimum stake or economic change is adopted. No new EVM/full-suite result.


## Frozen reward checkpoint — 2026-11-05

[Checkpoint research](STAKING_CHECKPOINT_REVIEW.md) preserves frozen-state entitlements across batched normalization and later operations in six Python tests. Total work remains linear, and live concurrency, authenticated state cuts, authority and lifetime-funded limits remain unsolved. Use this as an accounting oracle when comparing future designs; no protocol reset rule adopted.


## Outside review packets — 2026-11-06

[Integrity review](EXTERNAL_REVIEW_PACKETS.md): four archives and 911 listed hashes verified without executing supplied code. Prioritize source/harness review and independent checkpoint trust before promoting acquisition evidence. Issues #1/#3/#6/#7 remain open; no production or policy gate changed.


## Retained outside history — 2026-11-06

[Twenty current-reader checks](EXTERNAL_HISTORY_REVIEW.md) reproduce bounded reconstruction on outside retained data. Next evaluate an independently justified initial checkpoint, stale updates and conflicting evidence. Existing caller-pin tests already cover self-selected replacements; no new authority or canonicality claim.


## Checkpoint proof prerequisite — 2026-11-06

[SHA-256 branch inclusion](SHA256_BRANCH_REVIEW.md) adds an isolated bounded primitive with eleven focused checks. Next: external conformance vectors, fork-specific SSZ/header binding, then bootstrap and signature/update review. No caller-selected root is promoted to authority; production design remains open.


## External beacon-header vectors — 2026-11-06

[Five official root matches and ten focused checks](BEACON_HEADER_REVIEW.md) cover header hashing and derived body-root inclusion. Next: explicit fork-specific execution-payload header hashing and its inclusion branch. Bootstrap, signatures, finality and freshness remain open; no recovery-adoption policy changed.


## Capella payload root — 2026-11-06

[Five official payload roots and eleven focused checks](CAPELLA_PAYLOAD_REVIEW.md) verify the explicit fifteen-field format. Next compose the execution inclusion branch with a corresponding beacon header; retain separate fork/bootstrap/signature/finality gates. No current-mainnet or execution-validity claim.


## PR #16 evidence review — 2026-11-06

[Independent packet review](PR16_EVIDENCE_REVIEW.md): original trace checks pass, but unexpected-RPC and wrong-summary-hash controls incorrectly pass its comparison script. Await bounded corrections and rerun both negatives before merge. Preserve receipt provenance; issue #2 remains open.


## Capella structural composition — 2026-11-06

[Payload/body/header binding](CAPELLA_BINDING_REVIEW.md) passes 39 focused checks including seven composition cases. Next external corresponding combined vectors and explicit network/fork policy. Bootstrap, committee signatures, freshness and finality remain unresolved. PR16 unchanged; await requested comparison corrections before merge.


## External combined bootstrap — 2026-11-06

[Official minimal Capella fixture](EXTERNAL_CAPELLA_BINDING.md) passes the complete structural path; 41 Node and four decoder checks pass. Next bootstrap committee/root binding and explicit profile rules; no signature/update/finality or live trust claim.


## Minimal bootstrap committee inclusion — 2026-11-07

[Fixed-profile structural committee binding](MINIMAL_CAPELLA_BOOTSTRAP.md) passes official fixture and negative cases: 47 focused Node checks and four decoder checks. Next supported-network/bootstrap policy, trust-anchor sourcing and BLS validation boundary. No live trust, update acceptance, full-suite rerun or release clearance.


## Pinned bootstrap composition — 2026-11-07

[V1–V3 selection/metadata/committee composition](BOOTSTRAP_PROFILE_COMPOSITION_20261107.md) is published with unchanged sealed source bytes and separately recorded focused reruns (8/18/47 Node and four Python checks). The [historical binding checksum correction](BOOTSTRAP_BINDING_PROVENANCE_CORRECTION_20261107.md) is additive. Next: independently justified anchor sourcing/retention, explicit real network/fork configuration and BLS/consensus validation prerequisites before update acceptance. Matching provider labels/digests are not authority. Full suite not rerun; production and public-test gates remain blocked; CI deferred.


## Bootstrap trust gate — 2026-11-07

[Proposed acceptance checklist](BOOTSTRAP_TRUST_REQUIREMENTS.md) separates network identity, fork/slot policy, checkpoint provenance/recency, BLS validation, update transitions and operator independence. Initial execution was blocked by the disk guard; a subsequent Linux-backed [fixture fork-data experiment](BOOTSTRAP_FORK_DATA_CONSISTENCY_20261107.md) passed separate 7/9/13 focused checks and sealed its evidence. Strict 46-key layout admission now rejects unexpected config keys. Coherent alternative forks remain unauthenticated, and network selection, BLS, freshness, finality and update acceptance are unresolved. No full-suite rerun or policy adoption; CI deferred.

## Retained genesis-root fixture binding — 2026-11-07

[Focused evidence](BOOTSTRAP_RETAINED_GENESIS_BINDING_20261107.md) passed 2/2 new identity-binding checks and 13/13 unchanged fork-data checks. A coherent synthetic genesis-root substitution now rejects against a fixed retained fixture reference. This is not live checkpoint authentication or fork-schedule policy. Full suite, BLS, update acceptance, production and public-test readiness remain blocked; hosted CI deferred.

## Operator-reference comparison — 2026-11-07

[Focused results](BOOTSTRAP_OPERATOR_REFERENCE_20261107.md) passed 6/6 new checks, 2/2 retained-genesis regression and 13/13 fork-data regression. A supplied expected SHA-256 is not independently authenticated authority. Live network identity, checkpoint provenance, BLS, finality, update acceptance, production and public-test gates remain blocked. Full suite not rerun; hosted CI deferred.

## Source-pinned operator fixture — 2026-11-07

[The source-pinned fixture experiment](BOOTSTRAP_SOURCE_PIN_POLICY_20261107.md) passed separate 5/6/2/13 focused checks. Fixed source commitment rejects the tested dual-repin input, but does not establish trusted software delivery, independent reference provenance, live network selection, BLS, finality or update acceptance. Full suite not rerun; CI deferred.


## Retained source commitment — 2026-11-07

[Source replacement experiment](SOURCE_COMMITMENT_INSPECTION_20261107.md): 9 new focused checks and a separate 26-check regression pass on Node v24.22.1. A single embedded-pin substitution changes fixture admission but rejects against the unchanged retained source hash. Replacing that external hash too still passes as byte equality only. Next isolate dependency substitution and verified-byte execution binding, while independent software distribution and checkpoint authority remain unresolved. No production adoption, full-suite or declared-runtime run; CI deferred.


## Dependency substitution — 2026-11-07

[Five focused checks and a separate 35-check regression](DEPENDENCY_SUBSTITUTION_20261107.md) passed on Node v24.22.1. Next hold the inventory fixed and isolate dependency replacement between inspection and import. Independent manifest authority, runtime identity and binding checked bytes to execution remain open. No full-suite or declared-runtime run, new adoption behavior, BLS or production claim; CI deferred.


## Verification-to-import boundary — 2026-11-07

[Four controlled scenarios and a separate 40-check regression](VERIFIED_IMPORT_BOUNDARY_20261107.md) pass on Node v24.22.1. Capturing the checked bytes isolates later acquisition-file changes; a writable snapshot still permits substitution before import. Next define the actor and execution-isolation assumptions before implementing a loader. No production source, authentication or adoption change; full suite and declared runtime not run, CI deferred.


## Execution threat model — 2026-11-07

[The proposed five-module execution plan](EXECUTION_THREAT_MODEL_20261107.md) fixes the acquisition-file adversary, trusted host assumptions, exact import edges and twelve candidate review cases. Next verify a runtime API can evaluate captured source with explicit resolution, then test the bounded prototype. No API selected, runtime execution, loader implementation, new test total or production policy in this documentation increment. Independent manifest/checkpoint authority and BLS remain open; CI deferred.


## Captured fixture execution — 2026-11-07

[The bounded prototype](CAPTURED_FIXTURE_EXECUTION_20261107.md) passes 17 focused and a separate 44 regression checks on Node v24.22.1. It evaluates copied, hash-checked fixture sources through explicit import edges without a writable execution tree. Manifest, checker, host objects and runtime remain trusted assumptions; this is not a hostile-code sandbox or application integration. Next independent review/provenance and the separate checkpoint, real-network/fork, recency and BLS gates. Declared runtime/full suite not run; CI deferred.


## Individual BLS G1 prerequisite — 2026-11-07

[The isolated G1 adapter](BLS_G1_VALIDATION_20261107.md) matches all thirteen retained external decoder vectors after canonical re-encoding checks; 30 final focused and separate 44 regression tests pass. The initial raw-library mismatch remains documented, with 28 passes/1 failure preserved. Individual curve/subgroup validity does not establish committee membership, aggregate relationship or signatures. Next retained minimal-committee composition and aggregate-key relation, then G2/domain/signature and trust-policy gates. No root dependencies or acceptance changes; full suite/declared runtime not run, CI deferred.


## Minimal committee key composition — 2026-11-07

[The isolated G1/aggregate composition](MINIMAL_COMMITTEE_G1_20261107.md) passes 12 new, separate 30 G1 and 73 bootstrap regression checks. The supplied32-member aggregate matches the sum with repeated members counted. Ordered inclusion and aggregate equality remain distinct. Old structural modules are unchanged; only the new research result reports checked key/aggregate properties. Next external G2/signature vectors and explicit ciphersuite/domain behavior, with checkpoint/network/fork/recency and update gates still open. Full suite/declared runtime not run; CI deferred.


## G2 and single-signature POP vectors — 2026-11-07

[The isolated signature adapter](BLS_POP_SIGNATURES_20261107.md) passes 48 focused, separate 42 key/committee and 73 bootstrap checks. Explicit POP succeeds where the pinned default NUL fails on the same positive vector. The BLS ciphersuite tag is not the Ethereum consensus signing domain. No aggregate/participation, checkpoint authority or update acceptance is established. Next external fast-aggregate cases and separately evidenced consensus-domain/signing-root derivation; full suite/declared runtime not run, CI deferred.


## Supplied-key aggregate equations — 2026-11-08

[The bounded aggregate experiment](BLS_POP_AGGREGATE_20261108.md) passed 21 focused checks plus separate 90 BLS and 73 bootstrap regressions. Canonical key validation and a passing aggregate equation do not establish each participant's possession or authorization; a compensating-key control preserves that distinction. No participant-selection or update-acceptance integration. Next extend existing ForkData work with consensus-domain/SigningData evidence, and separately define authenticated participant selection and enrollment/possession prerequisites. Full suite and declared runtime remain unrun; CI remains deferred.


### Signed-history reader milestone — November 8, 2026

The draft [PR #19](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/pull/19) now reconstructs all26 signed local transactions through the existing readers, checking block links, transaction/receipt roots and recovered senders. Nine altered-history controls reject;167 existing reader tests pass. This is consistency under locally selected headers, not public-chain authentication or final-state replay. Accounting/ownership reconstruction now matches all 18 local snapshot fields; next prove final storage against the selected state root. The draft remains unmerged.


### Accounting reconstruction — November 8, 2026

Draft PR #19 matches all 18 final snapshot fields from the same 26 signed transactions. Ten semantic controls and the nine existing raw-history controls reject. Next gate: selected-state-root proofs for final custody/storage and token wallet balances. Local RPC comparison is not authenticated state or full EVM replay. No new full-suite run; release gates remain open.


## Current core focus — 2026-11-12

Independent persistence reproduction is pending externally. Primary engineering has moved to the NFT/custody journey: a contract-wallet owner lifecycle passed21 signed synthetic transactions and six rejection cases. Next reconstruct that new history and compare exact signed execution with a second engine. Previous recovery tests are not evidence for this new fixture. No economic decision or production gate changed.
