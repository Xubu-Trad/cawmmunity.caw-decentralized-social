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

open **recheck saved payouts** in the green portal to compare an archived receipt with the credits on the branch you select. unresolved posts stay visible without a current payout. [try the example or connect your node](docs/POST_PEER_CHECKPOINT.md#check-saved-payouts-in-the-green-portal)

you can now rebuild a feed of saved paid posts against one checkpoint. a re-mined post gets the payout from its current receipt. posts the reader cannot locate stay visible as unresolved. [offline feed commands](docs/POST_PEER_CHECKPOINT.md#rebuild-a-feed-of-archived-paid-posts)

a second geth node synced from genesis and found the exact signed post from pr #44. the original block was absent from its history. the same post still cost 5,000 caw, but two earlier stake withdrawals had reverted, so its receipt paid 2,000 and 3,000 to two stakers. the original receipt paid all 5,000 to one. both nodes ran under one operator. [check both receipts offline or repeat the peer sync](docs/POST_PEER_CHECKPOINT.md)

a saved receipt still reads the same after a chain reorganization. the reader can now tell you whether the original post block belongs to the history of a later block you trust. the offline example checks one post against two different histories. [try the branch check](docs/POST_BRANCH_RECHECK.md)

you can now verify a paid post offline even when another post and a transfer paid the same staker in the same block. the sample shows which 5,000 caw came from each post. [read the mixed-block example](integration/local-console/registration/OPERATOR.md#verify-one-paid-post-in-a-mixed-block)

you can now keep a signed paid post and verify its text, fee and staker credits after the portal and node go offline. the reader checks the saved bytes against the post block hash and transaction hash you supply. [try the published sample](integration/local-console/registration/OPERATOR.md#read-an-archived-paid-post-offline)

you can check the code running at all seven contract addresses on the combined disposable deployment from your own node. the reader checks upgrade slots and contract dependencies at that block. add a username to see who controls its nft and custody. no signing wallet is needed. [operator commands](integration/local-console/registration/OPERATOR.md#check-the-combined-disposable-deployment-by-block-hash)

after a wallet submits an action, the portal saves its hash and what you reviewed in this browser. reconnect the same account on the same deployment, choose the hash, and recheck it without signing again. the browser tests cover a mined deposit hidden until after timeout and a withdrawal receipt arriving after an account change. independent review of these fixes is pending.

on the disposable CAW runtime, the registration page now keeps the wallet you selected for posts, likes, recaws, follows, account deposits and withdrawals. we mined all six from one browser test signer with a second wallet present. a fresh MetaMask profile passed discovery and read-only checks. extension-signed settlement still needs a run. [start the portal and repeat both wallet tests](integration/local-console/registration/OPERATOR.md#use-one-wallet-across-the-runtime-deployment)

the green registration portal now lets you choose which browser wallet signs when several are installed. switching wallets clears the account and name review. [wallet checks and remaining limits](integration/local-console/registration/OPERATOR.md#choose-a-registration-wallet) · [five protocol delivery milestones](docs/ROADMAP.md#protocol-delivery-priorities)

one disposable deployment now runs likes, recaws, follows and nft-account withdrawals with the captured caw token code. the test checks what each wallet actually gained or spent. when the username changes hands, its new owner can withdraw its existing deposit. [fee splits, custody results and operator commands](integration/local-console/registration/OPERATOR.md#social-fees-and-nft-account-withdrawal)

the first protocol integration now runs username registration, a 420-character paid post, staker payout and stake withdrawal with the captured ethereum caw token code and disposable balances. the proposed username payment moves tokens to a sink and leaves supply unchanged. [replay the integration](integration/local-console/registration/OPERATOR.md#caw-token-registration-and-settlement) · [protocol delivery priorities](docs/ROADMAP.md#protocol-delivery-priorities)

another operator can now [download the hashed #37 trace and replay blocks 5–15](integration/local-console/registration/OPERATOR.md#reproduce-the-published-pr-37-trace-packet). the packet checks both the reproduced credits and the strict header failure. independent operator results for this packet are pending.

ahdmesh independently reproduced the [block-70 feed in #36](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/pull/36#issuecomment-7099431981). checkpoint provenance remains open. for #37, geth and ethereumjs agree on the stake and both credits after replaying the signed transactions. the first mismatch is in the username nft transfer at block 5. anvil kept two zero-valued storage entries for the sender’s nft balance and the token approval. those two entries explain blocks 5–7. the set changes at blocks 8, 14 and 15. eight explicit zero entries account for the final header difference, including the post author’s stake, which the pool only read. [per-block results](integration/local-console/registration/OPERATOR.md#how-the-difference-changes-through-block-15). [run the comparison and strict header check](integration/local-console/registration/OPERATOR.md#independent-execution-roots).

the paid-post reader now shows how a wallet can earn part of the fee even when its stake is zero at both ends of the block. on a fresh disposable chain it earned 3,750 of the 5,000 fixture CAW by holding 300 of the 400 eligible stake when the post executed. [replay the three transactions](integration/local-console/registration/OPERATOR.md#stake-at-publication).

the pr #36 sample is public. [download, check the hashes and replay the feed on your own machine](docs/PR36_OPERATOR_SAMPLE.md). the sample is pinned to block 70.

run the green portal from a clean checkout against your own disposable-chain node and compare a saved following feed byte for byte. [operator setup and block replay](integration/local-console/registration/OPERATOR.md).

the green portal now opens a local wallet registration flow. fund a disposable account, review the exact fixture price and recipient, approve, then register. the receipt checks the mint event and the nft owner at the mined block. [local setup](docs/C001_REGISTRATION_DECISION_PACKET.md#local-wallet-registration).

the green portal can check a name against a disposable registry at a specific block. run the registration reproduction, use the printed candidate address on the local portal and select the development chain in your browser wallet. the lookup reads availability and the current nft owner without requesting an account or signature.

username registration now has an ERC-721 candidate for local review. the proposed destination is the address used by the riddle-announcement wallet and gilgamesh’s username minter. it changes where CAW sits while total supply stays the same. the portal quotes the cost. [read the burn decision and reproduce the registration](docs/C001_REGISTRATION_DECISION_PACKET.md#historical-sink-candidate-for-public-review).

the green portal now prices a username using the manifesto’s recommended burn schedule. the same rules ran as compiled Solidity on a disposable Geth chain. this is a quote only. the actual CAW token rejects the specified zero-address transfer; registration and the burn decision still need public review.

anyone can now [download the Ethereum CAW balance reader](public/caw-balance.html?raw=1) and open the file directly in a browser. enter a public address to check its real CAW balance. the browser asks two Ethereum services for the same finalized block and checks the token code before showing the result. it needs no installation, wallet connection or gas.

you can now read a published research post on another computer with just its transaction hash and access to the same chain history. the reader verifies what was posted, who authorized it and where the fee went. the included block 18 example works offline with no wallet. [open the post reader](docs/PRODUCT_DELIVERY.md#read-a-published-post-by-transaction-hash).

the developer console can sign **and publish** a paid post on the disposable research network. a separate wallet approval sends the transaction. after a reload, the console checks the mined text and fee split against the saved review. the new transaction uses mock tokens. [run the product and inspect the receipt](docs/PRODUCT_DELIVERY.md).

a builder can now check a 5,000 mock-token post against a fresh local node before asking a wallet to sign. the reader proves who controls the account, what the payer can spend and how the fee would be split. in a 32-block replay it matched both historical signing requests and rejected the old review after ownership changed. the reader runs on the command line and in the developer console. the new signing desk shows the text and fee split, checks the connected wallet before and after its prompt, and verifies the returned signature with the account’s contract wallet. submission now requires a separate wallet approval. [open the signing desk](docs/PAID_POST_PREVIEW.md#run-the-signing-desk).

the local execution console now puts the account, actions, history and receipts in a keyboard-accessible terminal layout. its server rejects ambiguous requests and malformed node responses before using them in a review. [run the console](docs/LOCAL_EXECUTION_CONSOLE.md).

a fresh local block includes a signed transfer followed by a contract-wallet withdrawal. the offline reader locates the withdrawal by its hash and checks its controller, call and custody event against the selected header. a separate engine now replays the signed history from genesis and measures the selected withdrawal. custody moves from 10 to 8 mock tokens, the recipient wallet from 0 to 2 and account 2’s credit from 2 to 0. all 13 block state roots match geth. [repeat the mixed-block check](docs/WITHDRAWAL_PROOF_EXPORT.md#mixed-block-withdrawal)

we followed a withdrawal through the contract wallet. the controller signed it, and the wallet received two mock tokens. the console and offline reader now check both roles against the signed call, the deployed wallet code, the receipt and the balance changes. two fresh local runs produced the same proof file. [repeat the wallet withdrawal](docs/WITHDRAWAL_PROOF_EXPORT.md#verify-a-withdrawal-made-through-the-fixture-contract-wallet)

we verified the block 14 withdrawal again from a fresh node. it started at genesis, synced from a peer and supplied the signed transaction, receipt and ten account proofs. its headers linked the withdrawal to a new block 15 checkpoint calculated before either node started. both nodes ran on one machine. a checkpoint kept by another operator from the original run is still missing. [reviewer workflow](docs/WITHDRAWAL_PROOF_EXPORT.md#repeat-the-two-node-run)

updated November 22, 2026. **this is unfinished research software. there is no production-ready community.CAW network, and the local experiments use mock tokens.**

we are building something another person can inspect, reproduce and carry forward. the local execution console can already submit signed posts, transfer an experimental account and withdraw its credited mock tokens on a disposable chain. the original alpha interface remains a simulation. the console does real local execution, but its posts do not yet implement the manifesto's CAW payment and settlement rules.

after the console verifies a withdrawal, you can download the evidence and close the console. another builder can use the offline reader to check who signed, how much credit left custody and how much reached the recipient. the reader asks for the expected block hashes and deployment details separately. that gives the reviewer control over which local history they accept. [download and replay instructions](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/blob/research/constructor-lifecycle-20261108/docs/WITHDRAWAL_PROOF_EXPORT.md).

ahdmesh found four ways the console or its reader could give an incomplete picture around signing and receipts. the changes on draft PR #19 clear stale balances after a failed pre-sign check, bind a transfer recheck to the verified block and reject incomplete or contradictory history. the reviewer's hold is still in place. [independent review](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/pull/19#issuecomment-6918751018).

ahdmesh independently reproduced the scoped withdrawal replay, signing preview and state-proof checks on PRs #26–28. the new mined-post delivery still needs separate reproduction. selected local headers are not proof of public-chain finality, and this storage layout only supports the selected research contracts. general wallet support, actual CAW compatibility, registration, paid-post economics, durable public operation and release agreement remain unfinished.

the experimental application lives on [draft PR #19](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/pull/19). this README does not imply that its code has merged into main. [PR #16](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/pull/16) remains open at `60d5255`; the receipt-response guard was incorporated and its scoped checks passed. there was no new reply requiring a response at this check. that is not approval of the whole PR.

## what comes next

the hash reader now verifies a post between two ordinary native self-transfers. the post alone debited 5,000 mock tokens. both recipient credits and the one-unit remainder match the state proofs. [replay the mixed block](docs/PRODUCT_DELIVERY.md#mixed-block-post-accounting). a second run put account 2 withdrawals of 1 and 2 mock tokens around that same signed post. account 2 gained 1,360.636363636363636363 across the block, including a 1,363.636363636363636363 credit from the post. [verify the individual changes](docs/PRODUCT_DELIVERY.md#post-between-two-custody-withdrawals). independent operator reproduction of the hash reader and operation of a public social network remain open.

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
