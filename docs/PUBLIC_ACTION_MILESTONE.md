# Next milestone: one independently reproducible CAW action

Status: preparation only, 2026-11-01. This is the current priority within the existing [v0 scope](PROTOCOL_V0_SCOPE.md), not a new implementation, accepted specification or deployment authorization. Public-test and production gates remain blocked.

## Assessment of the supplied progress audit

The audit's central assessment matches the repository evidence: a substantial experimental alpha exists, while a manifesto-complete, independently accepted protocol does not. Public code and merged outside contributions are observable; agreement on release and operator-independent operation are not established.

The latest recorded suite is **1,251/1,251 across 73 files**, superseding the audit's 1,248 figure. This is finite local evidence, not a security audit. Package version remains alpha.46. Four WD-27 contributions have merged and 11 issues remain open at review time. The register contains **49 manifesto rows plus 10 R2 rows (59 total)**, not 59 manifesto rows plus 10. There are 16 conflict entries. These inventories are not completed-feature counts.

The audit's statement that its author independently decoded R2 is an attributed report, not a new reproduction performed during this engineering review. The preserved canon remains the reference; no cryptanalysis restart or author-identity inference follows. Treating the R1/R2 endpoints as engineering sources does not prove that every possible riddle layer is exhausted.

The recommendation to focus on one complete public action is adopted as an engineering priority. It does **not** justify deploying the current probe unchanged or skipping unresolved authority, asset and trust prerequisites.

## What the existing probe actually supports

[`CawPaidActionProbe.sol`](../experiments/paid-action/CawPaidActionProbe.sol) pins token address `0xf3b9569F82B18aEf890De263B84189bd33EBe452`, a fixed experimental fee/profile and an immutable registry/code hash. It is explicitly a three-account experiment without registration or mint burning. Existing local funding, account initialization and captured historical token behavior cannot be represented as public permissionless registration.

The same address on another chain does not establish the same token or state. Installing copied runtime/storage through a local node override is an experiment, not a public deployment of original CAW. A synthetic test token could support a separately labelled diagnostic, but cannot satisfy original-asset compatibility or C-001.

The [recorded token-source evidence](CAW_TOKEN_SOURCE.md) supports the zero-recipient incompatibility under its pinned context. C-001 blocks faithful production registration; it does not forbid separately labelled research into custody, posting or data acquisition. No substitute burn destination is selected here.

## Work packages and exit evidence

| Order | Deliverable | Reuse / open record | Evidence required to advance |
| --- | --- | --- | --- |
| 1 | Candidate and asset decision | [C-001](../sources/SPEC_CONFLICTS.md#c-001), [issue #1](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/issues/1), existing token/custody evidence | Explicitly identify original-asset candidate versus synthetic diagnostic; selected chain, token runtime/state provenance, funding limits and registration scope. No silent token substitution or real-fund deployment. |
| 2 | Exact one-action state machine | [v0 scope](PROTOCOL_V0_SCOPE.md), [account authority](ACCOUNT_AUTHORITY.md), [issue #5](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/issues/5), [issue #7](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/issues/7), [issue #8](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/issues/8) | Freeze provisional identity, text, fee, eligible-stake snapshot, payer exclusion, rounding, withdrawal and direct-submission behavior. State precisely which choices remain unaccepted. A fixed three-ID pool is not scalable staking. |
| 3 | Reproducible candidate artifact | Existing compiler/runtime and constructor records; [authority/dependency map](CURRENT_AUTHORITY_DEPENDENCIES.md) | Exact source, toolchain/lock, ABI, constructor/configuration, bytecode and dependency graph; show every authority path. Independently reproduce before claiming artifact equivalence. |
| 4 | Complete local candidate rehearsal | [callback review #2](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/issues/2), [wallet review #6](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/issues/6), retained signed-action experiments | Owner authorization, paid post, distribution and withdrawal on the same frozen candidate. Reject replay, stale ownership/epoch, wrong domain/chain, invalid wallet response and callback ordering; verify conservation. Existing experiments are inputs, not automatic acceptance of changed code. |
| 5 | Independently acquired public evidence | [issue #3](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/issues/3), [issue #4](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/issues/4), [recovery checker](RECOVERY_BUNDLE.md) | Two separately operated acquisition paths, complete creation-to-endpoint data, explicit chain-selection/finality trust and raw disagreement retention. Multiple URLs alone do not establish independence. |
| 6 | Builder-absent reconstruction and review | [operator independence](OPERATOR_INDEPENDENCE.md), [outside reproduction #10](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/issues/10) | Another builder operates from public artifacts without Xubu credentials, database or preferred relay; separately authored readers agree on full state/text and a reviewed authority model. Record objections and review evidence before release agreement. |

These are dependencies, not a completion percentage. Work on the state machine, build recipe and acquisition design can proceed while source decisions remain open; a release claim cannot skip their outcome.

## Minimum evidence packet for the action

- Candidate source commit, source/build hashes, ABI, constructor values and authority graph.
- Chain identity, deployment transaction/receipt, creation block/hash and code evidence; selected starting and ending headers with the source of their trust.
- Actual owner/account/epoch, exact signed domain and message bytes, transaction bytes, inclusion receipt and complete relevant transition history.
- Before/after asset reserves, account credits, stake allocations, dust and withdrawal result with explicit conservation equations.
- Acquisition operator/tool identities and complete inputs to both readers; canonical output hashes and retained conflicts, missing-data and reorg cases.
- Reproduction instructions and a separate review receipt identifying what the outside builder actually reran. Self-reports remain attributed until inspected.

No private keys or credentials belong in the packet. A valid action signature is not proof of canonical inclusion or finality; matching reader output is not proof of independent acquisition.

## Native-state discrepancy and parallel progress

The [native replay trace](NATIVE_RUNTIME_TRACE.md) now observes replay-side cleanup, while the captured node retains an empty account. This blocks declaring that fixture's complete execution verified. It does not prove all public chains or all other experiments are unusable.

The unresolved fixture must remain rejected. Acquisition-side source-built reproduction is pending: no local Rust compiler was found and hosted CI is deferred. A separately reviewed acquisition from another implementation could provide discriminating evidence without pretending to resolve the original build. Any such run needs its own pinned context and trust statement.

## Priority rule

Advance the one-action packages above. Add tests when they discriminate a stated failure or validate changed behavior; do not use increasing test counts as a proxy for protocol progress. Keep [cryptographic migration #15](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/issues/15) under review, but do not select homemade cryptography or make that design lane displace basic settlement, acquisition and operator-independence work.

The next concrete decision package is the candidate asset/registration boundary and the exact one-action economics. Deployment chain, public infrastructure, wallet/funding authorization and provisional rule acceptance are not established by this document. No network transaction is initiated.
