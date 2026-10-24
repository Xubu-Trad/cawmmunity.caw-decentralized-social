# cawmmunity.caw - decentralized - social

this repository is one public attempt to build the caw manifesto and the reproduced r2 message into a protocol that does not need the person who started it.

it is not an official CAW release. it is not community accepted. production is blocked.

the reason this repo exists is simple. the source material does not tell the community to find one developer and wait. it points toward a public github, open contribution, peer review, agreement on something solid enough to release, and a deployed system where the people who built it do not keep special power afterward.

so this is being built as **an implementation**, not **the implementation**.

other caw implementations should keep receiving review and patches. if one implementation slows down, the builders should not have to slow down with it. if you are already working somewhere else and the work is stalled, you do not have to abandon it to contribute here. preserve the authorship, bring the bounded change or evidence you can defend, and let other people review it.

the same rule applies to this repository. xubu's approval does not make a protocol compliant, and repository ownership must not become protocol authority. if this project eventually depends on xubu being available, then it has failed the standard it is trying to implement.

the target is harder than shipping an interface. another builder should be able to recover the public record, verify the relevant authority and history, run a compatible client, submit valid actions, recover funds under the protocol rules, and continue development without asking the original builder for permission.

that is still a design and evidence target. this alpha has not established it.

the repository is deliberately open before those decisions are finished because decentralization needs to shape the architecture while assumptions can still be replaced.

by teh ppl. for teh ppl.

![Commons in the current cawmmunity.caw alpha](docs/images/commons-alpha27.jpg)

Authentic screenshot of the local alpha. Synthetic accounts; no real funds. [Image provenance](docs/images/README.md).

<details>
<summary>Website entrance</summary>

![The cawmmunity.caw alpha website entrance](docs/images/website-alpha27.jpg)

</details>

**The frontend is a simulation. The protocol is a local experiment. Production remains blocked.** No real wallet, private messages or public media uploads are connected. This is not an official CAW release.

Two components, one repository:

- **Frontend:** [cawmmunity.caw - decentralized - social - alpha](docs/FRONTEND_POLICY.md) — the website and Commons conversation view.
- **Protocol:** [cawmmunity.caw - decentralized - social - protocol](docs/PROTOCOL_V0_SCOPE.md) — contracts, readers and local experiments.

These are project names. `.caw` does not establish domain registration, deployment or production readiness.

## where main stands now

the implementation head reviewed immediately before this README update was `c2656c1ea2762f56b04e4d4fbf4758778c657a9d` on 2026-10-24. the package remains `0.1.0-alpha.46`. the README update does not promote the protocol version or claim a new execution result.

the latest recorded full suite is **1215/1215 Node offline tests across 70 files**. the retained alpha.41 record also contains 65 Python tests. `executionVerified` remains false and `productionAccepted` remains false in the current witness-state receipt.

recent work has moved the evidence boundary forward in several narrow areas:

- selected registry ownership, epochs, approvals and operator state are now checked against header-bound proofs and reconciled with signed history under explicit assumptions;
- signed grant, revocation, delegated-transfer and non-owner withdrawal cases have been isolated so transfer permission is not silently treated as spending authority;
- wallet-state sensitivity has been observed with fixed signed intent while configuration changes around it;
- first-transaction replay is now bound to a selected parent and complete body, with declared account, storage and code dependencies checked against the chosen parent;
- read-only witness access fails closed on missing accounts and unselected storage instead of substituting zero values;
- the next execution-adapter step is documented, but no execution engine has been installed and no fork-aware transaction replay has been validated.

the public test candidate and production remain blocked.

### outside review

there has been one substantive outside reproduction so far. in issue #10, `tentencaw` reproduced both alpha.20 offline readers on Ubuntu 24.04 and obtained the same canonical reconstruction digest as the retained JavaScript and Python outputs. that is useful independent evidence for that bounded reader result; it does not establish independent acquisition, chain authenticity, consensus, execution correctness or production readiness.

there are still **no outside pull requests and no outside commits** in this repository. that is not something to hide. the next stage is to turn an xubu-authored codebase with outside reproduction into a genuinely multi-contributor review and implementation process.

### what still needs to be proven

the highest-value work is not more same-machine polish. it is closing the boundaries that would otherwise make the protocol depend on an original operator or an unreviewed interpretation:

1. execute a genuine signed transaction from proof-backed parent state without allowing missing evidence to become synthetic empty state;
2. authenticate chain/fork selection and reproduce acquisition through genuinely independent paths;
3. finish wallet and delegated-authority coverage, including contract-wallet and newer transaction-mode behavior where the protocol intends to support it;
4. resolve the open manifesto/R2 specification conflicts instead of silently choosing economics, registration, message limits, DM history, permanence, staking or release rules;
5. demonstrate recovery, operation and continued development with the original builder absent;
6. define a public review and release process where one maintainer, one merge or one person's approval cannot be confused with community acceptance.

the [roadmap](docs/ROADMAP.md), [59 mapped requirements](docs/MANIFESTO_R2_ALIGNMENT_REVIEW.md), [15 open conflicts](sources/SPEC_CONFLICTS.md) and [operator-independence register](docs/OPERATOR_INDEPENDENCE.md) are the current review map.

### how to contribute here

use a pull request for a bounded code or documentation change. state the problem, the source requirement or proposed deviation, the validation actually performed and the remaining concern. those are the same four fields in the repository PR template.

a good contribution can also prove that an existing assumption is wrong. failed reproductions and objections are part of the work if they are specific enough for another person to repeat.

preserve attribution when bringing work from another implementation. do not erase an unresolved disagreement just to make a branch merge cleanly. no contributor, including xubu, should receive protocol authority because they maintain the repository.

the first outside PR is still open.

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

**Recorded validation:** [1215/1215 Node offline tests across 70 files](evidence/WITNESS_STATE_TEST_RESULTS.json), including the bounded recovery checker; 65 Python tests recorded in alpha.41; 23 build assets. See [results and browser coverage](docs/VALIDATION.md). These finite checks establish neither an external audit, community agreement nor permanent availability.

## Read, reproduce, challenge

**Initial review target: alpha.20, [`91479b6dc8c9a264411d75177d43029e0266c354`](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/commit/91479b6dc8c9a264411d75177d43029e0266c354).** The [pinned baseline](docs/REVIEW_BASELINE.md) stays fixed as later work develops.

Follow the [current gates](docs/ROADMAP.md), reproduce a result with the [review guide](docs/REVIEW_GUIDE.md), or choose a [review issue](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/issues).

Trace the [59 mapped requirements](docs/MANIFESTO_R2_ALIGNMENT_REVIEW.md), [15 open conflicts](sources/SPEC_CONFLICTS.md) and [source coverage](docs/SOURCE_COVERAGE.md). Username registration remains blocked by the existing token's rejection of the literal zero-address transfer; [C-001](docs/C001_DECISION_REQUEST.md) preserves the evidence and decision request. A production authority graph and durable public recovery are unfinished.

R2 calls for public contribution, peer review and an agreed release, without developer backdoors, proxies or multisigs. These remain release gates. Upstream contributions target the relevant **cawdevelopment** repository only.

Original code and project-authored explanatory documentation use the [scoped MIT license](LICENSE_STATUS.md). Artwork, screenshots, primary texts and raw observations are excluded; preserved [third-party notices](experiments/token-source/NOTICES.md) retain their separate attribution.

[Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) · [Licensing](LICENSE_STATUS.md)
