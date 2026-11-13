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

## Current engineering status

Updated November 13, 2026. **Unfinished research; no production-ready network and no real funds in the local fixtures.**

**Reproduction setup update — November 13:** Node20.20.2/npm10.8.2 now has a committed console dependency lock and a verified clean install. Published commands also create a fresh Geth database, execute21 retained signed transactions and generate new headers/storage proofs:21 state roots,16 fields and five rejection controls passed. This reuses published fixture inputs; it is not independent reproduction or a complete source rebuild. [Setup, commands and remaining gaps](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/blob/research/constructor-lifecycle-20261108/docs/REPRODUCTION_SETUP.md).

**Posting history update — November 13:** Both signed local posts now pass the existing strict transaction, receipt, sender and header-bound storage readers across four consecutive blocks. Proven ownership follows the wallet-to-EOA transfer; all15 tampering/scope controls passed. This is selected local history, not public-chain finality, and the browser feed remains RPC-backed. [Verification, reproduction and boundaries](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/blob/research/constructor-lifecycle-20261108/docs/POSTING_HISTORY_VERIFICATION.md).

**Console history update — November13:** A separate verified-history panel now acquires signed blocks and ownership proofs through the strict readers, with no RPC-log fallback.12 integration checks,6 live browser checks and340 existing regressions passed. Failure/refresh clears acceptance; retries verify again. Local server and endpoint assumptions remain; no public-chain finality or independent reproduction is claimed. [Use, evidence and limits](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/blob/research/constructor-lifecycle-20261108/docs/CONSOLE_STRICT_HISTORY.md).

| Area | What is demonstrated | What remains open |
| --- | --- | --- |
| Local application | Real signed local posts, account handoff and new-owner withdrawals; posts retain historical authors | Paid posting integration, public registration and actual wallet-extension compatibility |
| Ownership and accounting | Bounded contract-wallet, transfer and withdrawal experiments; reconstruction and second-engine comparisons | General wallet coverage, final economics and production asset compatibility |
| History and recovery | Strict readers, state proofs, local two-client synchronization and interruption/recovery experiments | Independent reproduction of the latest package, public-chain authentication and broader failure coverage |
| Release | Public source, review records and explicit unresolved requirements | Accepted specification decisions, independent security review and an agreed release |

The original alpha interface is a simulation. The separate local execution console sends real transactions to a disposable local chain using mock tokens. Its new posting contract shares account authority with withdrawals but deliberately charges no CAW fee: this does **not** implement the manifesto's paid-post economics.

The latest console journey exercised a post, ownership transfer, another post and withdrawal. Fifteen browser cases, ten feed checks, 340 focused Node checks and ten launcher methods passed within their stated scope. Browser tests used a controlled wallet adapter. The implementation remains on [draft PR #19](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/pull/19), not merged functionality on main. [Exact source, evidence and instructions](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/blob/79f595561a9f476497c01a0c356605039d6d6900/docs/LOCAL_POSTING_CONSOLE.md).

**Next substantive work:** bind the new posting transactions/events to the existing authenticated history readers; obtain independent reproduction of the full account/post/withdrawal journey; reconcile paid settlement through explicit parameter and accounting review. [PR #16](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/pull/16) still awaits its receipt-error correction at the last check. A scoped pass does not approve the whole PR.

## Choose your starting point

| You want to… | Start here |
| --- | --- |
| Understand how the design follows the sources | [Alignment review](docs/MANIFESTO_R2_ALIGNMENT_REVIEW.md), [mapped requirements](sources/MANIFESTO_REQUIREMENTS.tsv), [unresolved conflicts](sources/SPEC_CONFLICTS.md) |
| Use the local application | [Console instructions on the research branch](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/blob/79f595561a9f476497c01a0c356605039d6d6900/docs/LOCAL_EXECUTION_CONSOLE.md) |
| Review or reproduce engineering | [Review guide](docs/REVIEW_GUIDE.md), [pinned baseline](docs/REVIEW_BASELINE.md), [roadmap](docs/ROADMAP.md) |
| Check whether a builder can disappear | [Operator-independence register](docs/OPERATOR_INDEPENDENCE.md) and the scoped recovery records |
| Contribute | [Contributing](CONTRIBUTING.md), [issues](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/issues), [pull requests](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/pulls) |

## Reproduce the right experiment

Pin an exact commit and name the experiment before installing tools. The frontend/offline suite and chain-execution experiments are separate environments. The historical root instructions specify Node 24.20.0; the recent local console uses Node 20.20.2. Do not treat these as interchangeable certifications.

The repository has experiment-specific npm/pnpm locks, not one complete lock for Node, Python, Geth, Reth and operating-system tools together. Use the selected experiment's documented installation and executable hashes. Where a dependency or fresh-generation step is missing, record it as a reproduction gap rather than substituting a version silently.

For reviewers pinned to PR19 commit `1a162a4`, [peer-recovery instructions](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/blob/1a162a4/docs/INDEPENDENT_PEER_REPRODUCTION.md) and [combined persistence instructions](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/blob/1a162a4/docs/PERSISTENCE_SYNC_REPRODUCTION.md) describe fresh client databases and newly acquired proofs using a preserved synthetic fixture. That is different from rebuilding the original fixture and toolchain from scratch. [Wallet replay instructions](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/blob/1a162a4/docs/WALLET_REPLAY_REPRODUCTION.md) describe another separate, bounded comparison.

Report file/hash inspection, offline verification, actual execution and independent reproduction separately. Include commit, runtime/client versions, command, output hashes, failures and limits. Do not turn NOT RUN into PASS. Never use real assets or personal wallet keys in disposable fixtures.

## Contribute and preserve the record

Bring a bounded change with the problem, source requirement or proposed deviation, validation actually performed and remaining concern. Reproductions, counterexamples, clearer documentation and removal of dependencies are valuable contributions. Preserve failed evidence and authorship. Maintainer approval and merged code alone are not release consensus.

The previous README is preserved in full in [the engineering history snapshot](README_ENGINEERING_HISTORY_20261113.md). It contains dated results, earlier failures, evidence tables and historical next steps; read the current section above for today's priorities. Detailed ongoing results belong in linked engineering documents rather than an ever-growing introduction.

**Maintenance rule:** preserve the mission section verbatim during routine updates. Changes to the mission require an explicit, separately reviewed request. Update the engineering status and linked workflow as evidence changes; do not rewrite the mission to fit implementation limitations.

[Security](SECURITY.md) · [Scoped licensing and third-party boundaries](LICENSE_STATUS.md) · [Contribution guide](CONTRIBUTING.md)
