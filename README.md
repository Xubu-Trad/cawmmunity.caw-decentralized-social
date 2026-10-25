# cawmmunity.caw - decentralized - social

cawmmunity.caw is a public implementation of the caw manifesto and the reproduced r2 message, being built from the ground up with decentralization treated as an architectural requirement rather than something to remove at the end.

the repository brings the application and protocol work into one place: a working local alpha frontend, experimental contracts and accounting, independent readers, recovery tooling, signed-action and authority tests, retained evidence, and a requirement map back to the source material.

the goal is to build something the cawmmunity can inspect while it is still being shaped, contribute to without asking one developer for permission, and eventually operate without the original builder remaining necessary.

that changes how this repo is being built.

manifesto and r2 requirements are mapped before they become implementation claims. where the source leaves a real conflict, the conflict stays visible instead of being silently decided in code. authority, history, recovery and operator disappearance are treated as protocol problems. successful tests are retained with their limits, and failed experiments are useful when they expose an assumption another builder should not repeat.

the release standard is not "xubu finished it." the standard we are working toward is a build that other people can reproduce, challenge, continue, and eventually agree is solid enough to release without developer backdoors, upgrade authority or an operator the protocol cannot survive without.

there is already a substantial implementation here, but there is still room to change important decisions before they harden.

if you are already building against the manifesto somewhere else, keep building. good work does not need to belong to one repository to matter. if a patch, test, reader, architecture objection or reproduction can improve this implementation, bring it here with its authorship and evidence intact.

the best version of this repo should eventually contain decisions and code that did not originate with xubu.

by teh ppl. for teh ppl.

![Commons in the current cawmmunity.caw alpha](docs/images/commons-alpha27.jpg)

Authentic screenshot of the local alpha. Synthetic accounts; no real funds. [Image provenance](docs/images/README.md).

<details>
<summary>Website entrance</summary>

![The cawmmunity.caw alpha website entrance](docs/images/website-alpha27.jpg)

</details>

## what is here

two connected components are being developed together:

- **Frontend:** [cawmmunity.caw - decentralized - social - alpha](docs/FRONTEND_POLICY.md) — the website and Commons conversation view.
- **Protocol:** [cawmmunity.caw - decentralized - social - protocol](docs/PROTOCOL_V0_SCOPE.md) — contracts, readers, recovery logic and local experiments.

the frontend is still a simulation and the protocol is still an experimental local build. no real wallet, private messages or public media uploads are connected. `.caw` is the project name here; it does not establish domain registration, deployment or production readiness.

production remains blocked until the protocol evidence, unresolved specification decisions, operator-independence work and public review gates are strong enough to justify moving beyond the alpha.

## current build

the implementation evidence immediately before the recent README work is based on `c2656c1ea2762f56b04e4d4fbf4758778c657a9d`, dated 2026-10-24. the package remains `0.1.0-alpha.46`.

the latest recorded full suite is **1215/1215 Node offline tests across 70 files**. the retained alpha.41 record also contains 65 Python tests. the current witness-state receipt still records `executionVerified: false` and `productionAccepted: false`.

the implementation now includes, among other things:

- selected registry ownership, epochs, approvals and operator state checked against header-bound proofs and reconciled with signed history under explicit assumptions;
- signed grant, revocation, delegated-transfer and non-owner withdrawal cases that keep transfer permission separate from spending authority;
- wallet-state sensitivity observed against fixed signed intent while configuration changes around it;
- first-transaction replay inputs bound to a selected parent and complete body;
- declared account, storage and code dependencies checked against the selected parent;
- read-only witness access that fails closed on missing accounts and unselected storage instead of inventing zero values;
- independent history/accounting readers, rollback and restart work, provider-comparison experiments, transaction/receipt commitments, sender recovery, registry permission reconstruction and portable static recovery;
- an execution-adapter plan that identifies the next proof-backed replay boundary without pretending execution has already been validated.

the next major step is not another interface pass. it is taking those proof-backed inputs through a real bounded execution path without allowing unavailable state to become synthetic empty state.

## what makes the build different

this repo is trying to make the difficult parts visible early.

**source before assumption.** the current review map traces [59 manifesto/R2 requirements](docs/MANIFESTO_R2_ALIGNMENT_REVIEW.md) and keeps [15 specification conflicts](sources/SPEC_CONFLICTS.md) open where the source does not give a defensible single answer.

**authority is part of the implementation.** owners, delegates, wallet modes, approvals, withdrawal rights, recovery paths and external dependencies are being treated as things that must be proven or removed, not explained away after deployment.

**history has to be recoverable.** a working frontend is not enough if another client cannot reconstruct the same record. the repository includes separate readers, retained captures, rollback/reorg experiments, header/body/receipt commitments, state proofs and recovery checks aimed at that requirement.

**missing evidence fails closed.** where a proof, account, slot, code value or history dependency is unavailable, the direction of the work is to reject the claim rather than fill the gap with a convenient default.

**failed experiments stay useful.** retained negative controls and explicit trust boundaries are part of the evidence. a passing test is only allowed to prove the surface it actually exercised.

**release is a community problem.** a merge, a maintainer's approval or a green local suite is not the acceptance rule. the repository still needs independent reproduction, outside code review, unresolved objections recorded, a builder-disappears exercise and a release process the community can inspect.

## where builders can move it

the highest-value open work is currently:

1. execute a genuine signed transaction from proof-backed parent state and preserve permanent failure when required evidence is missing;
2. authenticate chain/fork selection and reproduce acquisition through genuinely independent paths;
3. finish wallet and delegated-authority coverage, including contract-wallet and newer transaction modes where support is intended;
4. resolve the open manifesto/R2 decisions around registration, economics, staking/distribution, message limits, private-message history, permanence and release rules through explicit review rather than hidden implementation choices;
5. demonstrate recovery, operation and continued development with the original builder absent;
6. turn the current single-author implementation history into a real multi-contributor development history.

the [roadmap](docs/ROADMAP.md), [operator-independence register](docs/OPERATOR_INDEPENDENCE.md), [review guide](docs/REVIEW_GUIDE.md) and [open issues](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/issues) are the best places to choose a bounded piece of work.

## outside reproduction and contribution

`tentencaw` has already independently reproduced both alpha.20 offline readers on Ubuntu 24.04 and obtained the same canonical reconstruction digest as the retained JavaScript and Python outputs in issue #10.

that result is intentionally narrow: it reproduces the reader output. it does not establish independent acquisition, chain authenticity, consensus, execution correctness or production readiness.

there are not yet any outside pull requests or outside commits.

that makes the next milestone straightforward: another builder should be able to change this implementation, explain why, prove the bounded result and leave the repository stronger than they found it.

## contributing

use a pull request for a bounded code or documentation change.

the repository template asks four things:

- the problem and resulting behavior;
- the source requirement or proposed deviation;
- the validation actually performed;
- the remaining concern.

that is enough structure to make a contribution reviewable without requiring agreement in advance.

a useful contribution can add code, remove unnecessary authority, reproduce an existing result, break an existing assumption, improve recovery, clarify a source conflict, or show that a proposed design does not survive its failure case.

preserve authorship when bringing work from another implementation. keep disagreements visible until they are actually resolved. no contributor, including xubu, should gain protocol authority merely because they maintain this repository.

the first outside pr is still open.
## Try it locally

Use Node.js **24.20.0**. The frontend and Node offline tests need no third-party packages or install step. Review the source, then run:

```sh
npm test
npm run build
npm start
```

Open **http://127.0.0.1:4173/website.html** for the website or **http://127.0.0.1:4173/** for Commons. The server binds only to loopback; stop with Ctrl+C. Optional Python/EVM experiments have separate requirements in the [review guide](docs/REVIEW_GUIDE.md).

Draft, review a simulated fee, post, and inspect the receipt. Nothing is sent while typing. Reloading resets the demonstration; selected media stays a local preview.

## Evidence, with limits

| Record | What ran | Boundary |
| --- | --- | --- |
| [Alpha.20: paid action](docs/PAID_ACTION.md) | Nine signed posts using historical CAW token logic, fixed test NFT accounts and exact fee allocation | Local fork; no production registration |
| [Alpha.21: adversarial regression](docs/PAID_ACTION_REGRESSION.md) | 72 cases against the unchanged paid-action contract | Separate synthetic token and chain; broader review remains open |
| [Alpha.22: history acquisition](docs/PAID_HISTORY_ACQUISITION.md) | Two live collectors and two offline readers agree on a fresh 20-transaction history | Shared node and manifest trust; independent providers, chain authentication and reorg recovery remain open |
| [Alpha.28: branch recovery](docs/PAID_REORG_RECOVERY.md) | Two five-block branches acquired twice; replacement and restart recover exact selected messages and accounting | Controlled local rollback; provider agreement, authenticated history and public finality remain open |
| [Alpha.29: acquisition sessions](docs/PAID_ACQUISITION_SESSION.md) | Selected-history invalidation and full retry checked across 22 recorded-response cases | Offline replay; live concurrent changes, independent providers and public finality remain open |
| [Alpha.30: live acquisition change](docs/LIVE_ACQUISITION_CHANGE.md) | A real local branch change interrupts acquisition; fresh selection restores the complete record | One controlled request boundary; independent providers, authenticated history and public finality remain open |
| [Alpha.31: action replay after rollback](docs/ORPHAN_INTENT_REPLAY.md) | One exact signature is accepted once on each alternative branch; each branch rejects a second use | Local experiment; no branch-specific signing or public-finality rule adopted |
| [Alpha.32: action observations](docs/ACTION_OBSERVATION.md) | Selected-history status distinguishes acceptance, failed attempts and bounded absence across rollback | Offline observer; no finality, present validity or retry decision inferred |
| [Alpha.33: supplied provider histories](docs/PROVIDER_COMPARISON.md) | Every configured report must reconstruct and match the whole interval at the selected endpoint | Offline comparison; provider labels do not establish independence, authentication or finality |
| [Alpha.34: header integrity](docs/EXECUTION_HEADER_INTEGRITY.md) | Recompute execution-header hashes and check a linked interval against selected endpoints | Header integrity only; endpoint authentication, body proofs, execution validity and finality remain open |
| [Alpha.35: recovery with checked headers](docs/HEADER_CHECKED_RECOVERY.md) | Recheck headers and accounting together before adopting or restoring supplied history | Explicit adapter; endpoint authentication, body inclusion and finality remain open |
| [Alpha.36: actions with checked headers](docs/HEADER_CHECKED_ACTIONS.md) | Publish current action status only after checked recovery; recheck all saved branches at restart | Explicit offline mode; body inclusion, authenticated endpoints and finality remain open |
| [Alpha.37: provider reports with checked headers](docs/HEADER_CHECKED_PROVIDERS.md) | Require header and accounting checks for every configured report before shared action status | Explicit offline mode; matching labels do not prove independent sources or authenticated history |
| [Alpha.38: block receipt commitments](docs/BLOCK_RECEIPT_COMMITMENTS.md) | Rebuild complete receipt tries and match their roots to checked headers | Standalone London-format check; transaction association, endpoint authentication and adoption integration remain open |
| [Alpha.39: transactions and receipts](docs/BLOCK_TRANSACTION_COMMITMENTS.md) | Check complete transaction bytes against the selected header and associate receipts at the same index | Standalone London-format check; signatures, execution, endpoint authentication and adoption integration remain open |
| [Alpha.40: captured block bodies](docs/BLOCK_BODY_ACQUISITION.md) | Capture both local branches; verify commitments and reject mismatched transaction labels | Synthetic node with impersonated accounts; sender verification, authenticated endpoints and adoption integration remain open |
| [Alpha.41: signed body acquisition](docs/SIGNED_BODY_ACQUISITION.md) | Signed local submissions match acquired bytes, transaction hashes and both commitments on two branches | Fixed public test identities; generic sender verification, authenticated endpoints and adoption integration remain open |
| [Alpha.42: transaction senders](docs/BLOCK_SENDER_VERIFICATION.md) | Derive transaction senders from committed signature bytes, with explicit chain and legacy policy | Offline signature check; CAW authority, execution, authenticated endpoints and recovery integration remain open |
| [Alpha.43: history bound to block bodies](docs/PAID_BODY_HISTORY.md) | Bind captured CAW history fields to committed raw bytes, recovered senders and receipts before accounting reconstruction | Fixed local legacy format; full account authority, execution and recovery integration remain open |
| [Alpha.44: signed post permissions](docs/PAID_POST_SIGNATURES.md) | Rebuild exact post signing digests and match successful posts to reconstructed historical owners | Explicit ordinary-account assumption; code absence, registry execution, endpoints and recovery integration remain open |
| [Alpha.45: input admission](docs/INPUT_BOUNDARY.md) | Bound browser inputs and reject ambiguous fields before domain validation | Local input and request controls; no network anonymity or new settlement authority |
| [Alpha.46: registry permissions](docs/PAID_REGISTRY_PERMISSIONS.md) | Match direct approvals and transfers to reconstructed permissions and recovered transaction senders | Fixed-registry assumptions; code/state authentication, execution, callbacks and recovery integration remain open |

**Recorded validation:** [1241/1241 Node offline tests across 73 files](evidence/REPLAY_ACCOUNT_TEST_RESULTS.json), including the bounded recovery checker; 65 Python tests recorded in alpha.41; 23 build assets. See [results and browser coverage](docs/VALIDATION.md). These finite checks establish neither an external audit, community agreement nor permanent availability.

## Read, reproduce, challenge

**Initial review target: alpha.20, [`91479b6dc8c9a264411d75177d43029e0266c354`](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/commit/91479b6dc8c9a264411d75177d43029e0266c354).** The [pinned baseline](docs/REVIEW_BASELINE.md) stays fixed as later work develops.

Follow the [current gates](docs/ROADMAP.md), reproduce a result with the [review guide](docs/REVIEW_GUIDE.md), or choose a [review issue](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/issues).

Trace the [59 mapped requirements](docs/MANIFESTO_R2_ALIGNMENT_REVIEW.md), [15 open conflicts](sources/SPEC_CONFLICTS.md) and [source coverage](docs/SOURCE_COVERAGE.md). Username registration remains blocked by the existing token's rejection of the literal zero-address transfer; [C-001](docs/C001_DECISION_REQUEST.md) preserves the evidence and decision request. A production authority graph and durable public recovery are unfinished.

R2 calls for public contribution, peer review and an agreed release, without developer backdoors, proxies or multisigs. These remain release gates. Upstream contributions target the relevant **cawdevelopment** repository only.

Original code and project-authored explanatory documentation use the [scoped MIT license](LICENSE_STATUS.md). Artwork, screenshots, primary texts and raw observations are excluded; preserved [third-party notices](experiments/token-source/NOTICES.md) retain their separate attribution.

[Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) · [Licensing](LICENSE_STATUS.md)
