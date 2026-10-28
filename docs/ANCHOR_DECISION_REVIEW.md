# anchor authority: decision record for review

Status: **UNRESOLVED / no production policy adopted**. Review baseline: `da797434b9f58a93277ea8969fa52b11895b85eb`. This record consolidates the existing trust-model questions; it does not add a new reader or declare another local run independent. Discussion belongs in [acquisition issue 3](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/issues/3).

FACT -- the [signed ledger experiment](SIGNED_LEDGER_RECONCILIATION.md) now checks complete signed bodies, receipts and selected endpoint ledger witnesses together. Its two same-height, distinct branches both pass when separately selected. The reader explicitly returns endpointAuthenticated, consensusVerified, finalityVerified, freshnessVerified and productionAccepted as false. It does not select between the branches, contact a provider, adopt application state or grant spending authority.

INFERENCE -- making the selection digest harder to replace cannot establish why that selection should govern account permissions. More local wrappers around the same evidence would not close this gap. The existing OI-02, OI-03, OI-04 and OI-09 gates remain open.

## decisions required before a production anchor adapter

| ID | decision and required record | present status | refusal boundary to demonstrate |
| --- | --- | --- | --- |
| AT-01 | exact network, genesis identity, supported consensus/execution forks and upgrade handling | London31337 is only the current fixture profile; production profile unselected | reject unsupported network/fork before interpreting account authority |
| AT-02 | who or what authenticates the initial checkpoint, including bootstrap assumptions and replacement procedure | a retained digest supplies integrity relative to its supplier; no production trust source selected | a substituted self-consistent checkpoint must not become trusted merely by matching its own hashes |
| AT-03 | how a finalized consensus observation binds to the exact execution header used for registry and ledger proofs | no consensus adapter implemented | unrelated consensus/execution selections must not be combined |
| AT-04 | permitted checkpoint age, clock assumptions, restart/expiry and unavailable-finality behavior | no numeric freshness policy adopted | stale or unavailable evidence must not silently become current permission |
| AT-05 | conflicting observations, rollback limits and recovery after interrupted selection updates | local competing branches demonstrated; no production adoption policy | preserve conflicting observations and stop adoption; no URL-count vote or silent anchor replacement |
| AT-06 | complete registry/token/dependency identities at the same selected state, constructor allocation and supported account modes | fixture code/storage checks are partial evidence; production graph absent | matching runtime alone must not authenticate allocation, token backing or contract-wallet authority |
| AT-07 | acquisition operator identities, shared infrastructure, surviving archive/storage sources and replacement recipe | two collectors share one local node; independent acquisition not demonstrated | missing original services must produce an explicit unavailable result, not a permanence claim |
| AT-08 | independent review and reproduction records, objections, accepted scope and release decision | no adopted release decision in this record | no maintainer signature, repository merge or poll substitutes for technical validation or release agreement |

these are review requirements, not a claim that production refusal cases have already been executed. no deadline, trusted service, validator set or fallback key is selected here.

## alternatives to compare

1. **retained checkpoint, inspection only**: this is the current implemented boundary. a reviewer can reproduce relative to an explicit selection. it remains unsuitable as a claim of current fund authority.
2. **operator-controlled validating node**: proposed option, not an implemented adapter. document its network/bootstrap/sync/finality assumptions and the exact source of its finalized execution selection. a node URL alone is not evidence that validation occurred. show replacement without xubu credentials or infrastructure.
3. **independently verified consensus/light-client evidence**: proposed option, not an implemented adapter. document supported verification rules, bootstrap trust, update/expiry behavior, execution-header linkage and independently reviewed implementation. it is not automatically trust-free.

IDEA -- compare options 2 and 3 using the same AT-01 through AT-08 record before implementation. retain option 1 for offline inspection throughout. this recommendation does not choose a production design. provider agreement may expose disagreement; it does not by itself establish canonicality or operator independence.

## concrete review request

please propose one explicit profile and trust path, with evidence for each AT row, assumptions that cannot yet be verified, and the smallest negative-case experiment that could disprove the proposal. explain how a different builder can acquire and verify the same state after the original operator disappears. disagreement about bootstrap trust belongs in this record before it becomes a hidden code default.

for independent reproduction, pin the baseline commit above and run the published signed-ledger checker. report runtime, input hash, output and limitations. reproducing its fifteen groups on another machine is useful OI-09 evidence, but it still does not authenticate a public chain or close AT-01 through AT-08. fresh fixture acquisition is a separate task and will have different block hashes/signatures; compare asserted relations, not byte identity of a new run.

## next work

keep acceptance flags unchanged and keep the frontend in simulation. review a concrete anchor proposal in issue 3; record independent reproduction separately in the existing reproduction lane. production transport should consume an explicit reviewed trust decision rather than invent one. protocol work on separately bounded authority and dependency gaps can continue while this review is open.

Source review only: no new tests, network experiment, public deployment or gate closure in this update. [Source identities](../evidence/ANCHOR_DECISION_REVIEW_SOURCES.json), [existing trust model](RECOVERY_TRUST_MODEL.md), [dependency graph](CURRENT_AUTHORITY_DEPENDENCIES.md), [operator gates](OPERATOR_INDEPENDENCE.md).
