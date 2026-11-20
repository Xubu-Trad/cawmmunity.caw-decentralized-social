# cawmmunity.caw — decentralized social

<!-- STABLE_MISSION_START: change only by explicit reviewed request -->
## Our mission

community.CAW exists to help turn the CAW manifesto into social software that its community can understand, verify, operate and carry forward without depending on any indispensable developer, company or website.

The aim is user-owned identity, accountable handling of assets, independently recoverable history and a choice of interfaces. A builder should earn confidence through inspectable work, not acquire permanent control because they wrote or deployed it. That standard applies equally to Xubu and every contributor.

We build in public, preserve evidence, welcome independent review and make unresolved decisions visible. We will not present a working screen, a passing test or a deployment as proof that the whole protocol is complete. Release requires demonstrated behavior, peer review and an open agreement process.

### What is the manifesto?

The [CAW manifesto](https://github.com/cawdevelopment/manifesto/blob/main/README.md) is a proposed specification for a decentralized social clearing house. In everyday terms, it describes a social network whose account identity and associated assets belong to the holder of a username NFT, with public messages, CAW-based social actions, private messaging and permanent, trustless records.

It distinguishes the shared protocol from the websites and apps people use to access it. Different interfaces may make different presentation and moderation choices; one interface should not become the only way to use the system. It also calls for public development, community review and acceptance, and removal of special deployer control without multisigs or upgradeable proxies.

The text contains ambiguities and conflicting details. Our requirement mapping and conflict register preserve those questions rather than quietly replacing the specification with a developer's preference. The linked original remains the source; this introduction is a summary.

### What does the recovered R2 message add?

[R2, recovered from zrUfKaKV](https://github.com/Xubu-Trad/caw-lab/blob/canon/layers/R2-020_hex_transposition/MESSAGE.md), describes a shared development process: publish the code, contribute according to the manifesto or clearly agreed changes, review it together and agree on release. It rejects developer backdoors, proxies and multisigs, and says deployment should not leave its builders above ordinary community members.

Its practical lesson for this implementation is that progress must remain possible when any builder disappears. The [reproduction instructions](https://github.com/Xubu-Trad/caw-lab/blob/canon/layers/R2-020_hex_transposition/REPRODUCE.md) establish the recovered bytes; they do not authenticate an author or certify a deployed application. We use the text as a development reference with that distinction intact.

### What is this implementation?

This is a separate community implementation and reference alpha, not an official CAW release or a claim to ownership of CAW. It brings together original implementation work, requirement maps, experimental contracts, independent readers, retained evidence and application interfaces. Reused material retains its provenance and licensing boundaries.

The destination is a system others can reproduce and operate without Xubu's account, infrastructure, credentials or permission. That is a requirement to demonstrate, not a property we claim has already been achieved.

<!-- STABLE_MISSION_END -->

## where the build stands

we followed a withdrawal through the contract wallet. the controller signed it, and the wallet received two mock tokens. the console and offline reader now check both roles against the signed call, the deployed wallet code, the receipt and the balance changes. two fresh local runs produced the same proof file. [repeat the wallet withdrawal](docs/WITHDRAWAL_PROOF_EXPORT.md#verify-a-withdrawal-made-through-the-fixture-contract-wallet)

we verified the block 14 withdrawal again from a fresh node. it started at genesis, synced from a peer and supplied the signed transaction, receipt and ten account proofs. its headers linked the withdrawal to a new block 15 checkpoint calculated before either node started. both nodes ran on one machine. a checkpoint kept by another operator from the original run is still missing. [reviewer workflow](docs/WITHDRAWAL_PROOF_EXPORT.md#repeat-the-two-node-run)

updated November 18, 2026. **this is unfinished research software. there is no production-ready community.CAW network, and the local experiments use mock tokens.**

we are building something another person can inspect, reproduce and carry forward. the local execution console can already submit signed posts, transfer an experimental account and withdraw its credited mock tokens on a disposable chain. the original alpha interface remains a simulation. the console does real local execution, but its posts do not yet implement the manifesto's CAW payment and settlement rules.

after the console verifies a withdrawal, you can download the evidence and close the console. another builder can use the offline reader to check who signed, how much credit left custody and how much reached the recipient. the reader asks for the expected block hashes and deployment details separately. that gives the reviewer control over which local history they accept. [download and replay instructions](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/blob/research/constructor-lifecycle-20261108/docs/WITHDRAWAL_PROOF_EXPORT.md).

ahdmesh found four ways the console or its reader could give an incomplete picture around signing and receipts. the changes on draft PR #19 clear stale balances after a failed pre-sign check, bind a transfer recheck to the verified block and reject incomplete or contradictory history. the reviewer's hold is still in place. [independent review](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/pull/19#issuecomment-6918751018).

these results come from local experiments run by us. **independent reproduction is still pending.** selected local headers are not proof of public-chain finality, and this storage layout only supports the selected research contracts. general wallet support, actual CAW compatibility, registration, paid-post economics, durable public operation and release agreement remain unfinished.

the experimental application lives on [draft PR #19](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/pull/19). this README does not imply that its code has merged into main. [PR #16](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/pull/16) remains open at `60d5255`; the receipt-response guard was incorporated and its scoped checks passed. there was no new reply requiring a response at this check. that is not approval of the whole PR.

## what comes next

repeat the offline check from a separate installation and extend the console reader to the experimental contract wallet. today the download covers regular-wallet withdrawals in single-transaction blocks. mixed-block attribution, paid-post economics and public operation remain open.

## find your starting point

| what you want to do | where to begin |
| --- | --- |
| understand the requirements | [alignment review](docs/MANIFESTO_R2_ALIGNMENT_REVIEW.md), [mapped passages](sources/MANIFESTO_REQUIREMENTS.tsv), [unresolved conflicts](sources/SPEC_CONFLICTS.md) |
| run the experimental console | [local console instructions](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/blob/research/constructor-lifecycle-20261108/docs/LOCAL_EXECUTION_CONSOLE.md) and [posting instructions](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/blob/research/constructor-lifecycle-20261108/docs/LOCAL_POSTING_CONSOLE.md) |
| reproduce a pinned experiment | [ownership reproduction package](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/blob/research/constructor-lifecycle-20261108/docs/CONSOLE_OWNERSHIP_REPRODUCTION.md), [environment setup](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/blob/research/constructor-lifecycle-20261108/docs/REPRODUCTION_SETUP.md) |
| review the current work | [review guide](docs/REVIEW_GUIDE.md), [baseline](docs/REVIEW_BASELINE.md), [roadmap](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/blob/research/constructor-lifecycle-20261108/docs/ROADMAP.md) |
| examine developer independence | [operator-independence register](docs/OPERATOR_INDEPENDENCE.md) |
| contribute a finding or change | [contribution guide](CONTRIBUTING.md), [issues](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/issues), [pull requests](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/pulls) |

## reproduce the right version

pin the commit and experiment first. the historical root frontend/offline instructions specify Node 24.20.0; the recent local console uses Node 20.20.2. use the selected experiment's lockfile, client hashes and commands. we have experiment-specific dependency locks, not one complete lock for every runtime and operating-system tool.

the ownership reproduction package has a frozen 64-file input set. later console improvements are separate evidence increments, not permission to move a reviewer's target. earlier reviewers pinned to `1a162a4` should retain that baseline and its original NOT RUN results until they execute those checks.

report file inspection, offline verification, execution and independent reproduction separately. include the exact commit, versions, commands, output hashes and failures. never use personal wallet keys or real assets in these fixtures.

## building together

bring a bounded change, the problem it addresses, what you actually tested and what remains uncertain. reproductions, counterexamples and clearer instructions matter as much as new code. preserve failed evidence and credit the people who contributed it. a merge is not community release agreement.

the [previous engineering overview](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/blob/research/constructor-lifecycle-20261108/docs/ENGINEERING_PROGRESS_ARCHIVE_20261114.md) preserves the detailed chronology and links. the [earlier history snapshot](README_ENGINEERING_HISTORY_20261113.md) remains available too. historical next steps are not current status.

the mission above stays unchanged during routine engineering updates. progress and limitations belong here and in the linked workflow; we do not rewrite the mission to fit the implementation.

[security](SECURITY.md) · [licensing and third-party boundaries](LICENSE_STATUS.md) · [contributing](CONTRIBUTING.md)
