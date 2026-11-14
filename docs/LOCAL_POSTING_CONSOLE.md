# Local posting, account handoff and withdrawal

The local console adds a real compose-and-submit path: a disposable wallet signs a transaction, the local Geth chain emits the post, and the console reads a bounded chronological feed. This is an unpaid research capability for existing account 2, not the adopted CAW paid-post protocol or a public release.

## What changes

`PostingResearch.sol` is a separate contract bound permanently to the selected registry address and runtime hash. It reads the current account owner and ownership epoch on every publication. A fixture contract wallet publishes through its controller's `execute` call; a supported plain owner publishes directly after an account transfer. Each successful post consumes a separate account posting nonce, which continues across ownership transfers. The event retains the author at publication, epoch, nonce, exact text and text hash.

The existing registry and custody runtimes remain unchanged. Posting does not charge or distribute CAW, burn tokens, or change custody credit. Native transaction gas still applies. Paid posting in the frozen candidate remains a separate design requiring explicit economic and specification reconciliation; this addition does not merge or resolve it.

The provisional C-004 interpretation allows 1–420 Unicode scalar values and at most 1,680 UTF-8 bytes. Malformed UTF-8 and unpaired surrogates reject. No trimming or normalization occurs, including for leading U+FEFF. Scalar count is not necessarily the number of visible characters; this rule remains a research choice.

## Review and recovery

Before signing, the browser independently encodes the selected text, owner, epoch, nonce and contract, compares the bytes with the server plan, and rereads current authority. Editing the text or changing wallets invalidates review. Posting uses the shared saved-action journal: an uncertain submission blocks another action, survives reload and is checked using the same transaction hash. A successful receipt must include the exact selected posting event. There is no automatic resubmission.

Feed reads check the selected genesis, five runtime hashes, posting registry binding and creation receipt. They require a complete nonce sequence from creation, ordered logs, matching local block hashes, valid text and matching text hashes. Missing history, malformed responses and changed block identities reject instead of becoming an empty timeline. The current limit is 1,024 blocks after creation and 128 posts; exceeding it reports `LOCAL_HISTORY_LIMIT`. Pagination and long-lived history acquisition are not implemented.

The feed and receipt checks still trust the selected local RPC. Comparing its blocks, logs and state does not establish cryptographic receipt inclusion, public-chain consensus or independent availability. Text is rendered as text content, never as executable HTML.

## Reproduce locally

Use the PR #19 research branch, Node 20.20.2, Python 3 and the previously reviewed Geth binary. Install the isolated dependencies with `npm ci --ignore-scripts --no-audit --no-fund --prefix integration/local-console`. The package selects ethers 6.16.0 and solc 0.8.30. The build verifies the compiler file, source, ABI, creation bytecode and runtime-template hashes. Deployment verifies the creation transaction and complete runtime after inserting the immutable registry values.

From the repository root, start a fresh fixture:

```text
python3 integration/local-console/launch.py --geth PATH_TO_REVIEWED_GETH --capture evidence/wallet-headers-20261112/capture.json --genesis evidence/wallet-headers-20261112/genesis.json --selection evidence/wallet-state-20261112/selection.json --registry-proof evidence/wallet-headers-20261112/evidence.json --output NEW_LOCAL_DIRECTORY
```

The launcher replays the existing ten signed setup transactions, compiles and deploys the separate posting contract, and writes `console.json` and build/deployment evidence beneath the selected directory. It prints the loopback RPC; the console defaults to `http://127.0.0.1:4200`. Its existing memory/disk guards remain enabled. Stop the launcher to stop its owned services. Use fresh directories and retain failed runs.

Connect only a disposable wallet on local chain 31337, then compose, review and explicitly approve a post. The fixture uses public test keys; never fund these accounts on a public network. See [local wallet setup](LOCAL_EXECUTION_CONSOLE.md) and [account handoff boundaries](LOCAL_ACCOUNT_HANDOFF.md).

For a fresh chain, run the contract checks and then its read-only feed controls:

```text
node integration/local-console/test-posting-contract.mjs NEW_LOCAL_DIRECTORY/console.json NEW_LOCAL_DIRECTORY/posting-build/posting-artifact.json NEW_CONTRACT_RESULTS
node integration/local-console/test-posting-feed.mjs NEW_LOCAL_DIRECTORY/console.json NEW_FEED_RESULTS
```

The feed test expects the contract test's three posts. Use a separate fresh fixture for the browser journey, which expects no posts and two units of credit:

```text
node integration/local-console/test-posting-browser.mjs PATH_TO_CHROMIUM_OR_EDGE http://127.0.0.1:4200 LAUNCHER_PRINTED_RPC NEW_BROWSER_RESULTS
```

The controlled browser adapter uses disposable keys 3 and 4, records any local gas funding separately, and checks exact transaction bytes. It is not an installed wallet-extension test.

## Evidence and remaining work

Observed local results: 340 focused Node checks and ten Python launcher tests pass. Three signed contract publications cover ordinary Unicode, 420 scalar values and 1,680 bytes, with unchanged custody accounting. The feed suite passes ten checks, including eight isolated response-corruption controls and restoration of the unchanged baseline.

Fifteen browser cases pass on a fresh fixture: one contract-wallet post, account handoff, one direct new-owner post, and withdrawal of the two attached mock units. Reloaded receipt recovery uses the original transaction without resubmission. Final state is two posts, account credit zero, new-owner balance two and custody eight. Historical authors and exact text survive handoff and withdrawal, including leading U+FEFF; markup remains inert. The former owner cannot publish or withdraw. The first browser attempt stopped because the harness clicked Connect before asynchronous feed loading finished; no UI action was submitted. That failure is retained. The harness now waits for enabled controls; product verification was not relaxed.

Compact results: [browser journey](../evidence/local-posting-console-20261112/browser.json), [contract checks](../evidence/local-posting-console-20261112/contract.json), [feed checks](../evidence/local-posting-console-20261112/feed.json), [pinned build](../evidence/local-posting-console-20261112/build/posting-artifact.json). The feed corruption controls are read-only; the successful contract and browser publications use signed local transactions. These checks are from the same operator and are not independent reproduction.

Public registration, real-token economics, general contract-wallet support, EIP-712/relay/session posting, public-chain authentication, independent reproduction and production acceptance remain open. Transfer still inherits the existing registry's lack of an expected-epoch argument; pre-signing checks do not eliminate post-signing races. Browser storage is not an OS-crash durability guarantee. No claim of permanent availability or complete manifesto/R2 compliance follows from these local results.


See [the consolidated setup guide](REPRODUCTION_SETUP.md) for Node/npm versions, the committed lockfile and fresh header/proof generation.
