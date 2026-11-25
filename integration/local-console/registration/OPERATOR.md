# Run the green portal against your own node

For the published PR #36 fixture, start with the [exact download and replay commands](../../../docs/PR36_OPERATOR_SAMPLE.md).

Use Linux, Bash, curl, Node.js 20.20.2 and npm. Use Geth 1.17.10 (commit 1df30b18) for the disposable-chain import. Obtain your Geth binary from a source you trust. No publisher browser, keys or wallet are needed for verification.

From the root of a clean checkout:

```sh
b=integration/local-console/registration
npm ci --prefix integration/local-console --ignore-scripts --no-audit --no-fund
npm ci --prefix "$b" --ignore-scripts --no-audit --no-fund
```

For a username registration approval, compare the selected signer, token destination, registry spender and exact amount on the review screen with the wallet request. The registration payment sink receives the payment when the name is registered.

For a paid action, compare the token address, spender and CAW amount on the approval screen with your deployment. The next signature sends the action to its own contract. Withdrawals require only the action signature.

## Using a node you already operate

Select the deployment addresses independently of the HTML. The example manifest is for the disposable November 22 chain. Your node must have its canonical blocks, transactions, receipts, logs and historical registry state. A new empty chain with ID 1337 cannot verify an earlier export.

```sh
bash "$b/operator.sh" http://127.0.0.1:8545 "$b/operator-deployment.json"
```

Open **http://127.0.0.1:34735/website.html**. The following feed is on port 34742. The launcher requires free loopback ports 34735, 34736 and 34738–34742. It starts readers against the supplied node and existing contracts; the funding service is disabled. Wallet-enabled pages can still request signatures if explicitly used. From another terminal in the checkout:

```sh
node integration/local-console/registration/verify-export.mjs /path/to/feed.html
```

The verifier reads the file as bytes. It obtains the username, height and block hash without executing the HTML, requests an independent reconstruction at that exact block, and compares the **entire HTML file**, including follows-derived item selection, text, order, receipt details and amounts. A missing checkpoint, wrong branch, changed credit or extra byte fails verification. MATCH prints the document digest and checkpoint. Your trust anchors are your node's view of the chain, the selected deployment, and this version of the renderer. A match does not authenticate the publisher or establish public-chain finality.

## Replaying a historical export

The operator retaining the original chain can prepare the block stream below. Select the block height and hash from the snapshot footer and compare them with a separately retained checkpoint when available.

```sh
node "$b/export-blocks.mjs" http://127.0.0.1:34898 HEIGHT BLOCK_HASH history.rlp
```

The exporter saves blocks 1 through the specified height, including signed transaction bodies. Review disclosure of that history before sharing it. Transfer the history and HTML separately from the repository. To re-execute into a new Geth database and check the HTML in one command:

```sh
GETH=/path/to/geth bash "$b/replay-export.sh" feed.html history.rlp "$b/operator-deployment.json"
```

This command is specific to Geth's disposable dev genesis. It uses port 34899 as well as the portal ports and leaves the fresh database and logs at the printed path. The verifier shuts down when it finishes. Use operator.sh for an ongoing session. This is an execution/reconstruction check on supplied history. Independent custody of the historical branch needs a separately sourced checkpoint.

The November 22 sample for portal1795395428 was reconstructed at block 70, hash `0xd5d515de74ec31b3704fc8e378257a74f63736b792b5e95223aeadcb61b8e730`. Its 110,132-byte block stream has SHA-256 `77e14cd827b665efcadf29c0b24905741e73ac161ad35ff6cf95a3a99c8b7d95`. HTML SHA-256 is `5f24dd8ecf92a81f6223a05dad7445cab415db290c099e264c8ce578f11261ee`. A second isolated Geth process on the same machine reproduced the HTML. A changed copy failed.

## Stake at publication

Install the two locked dependency sets above. Use Linux with unprivileged user/network namespaces enabled, iproute2, and Anvil 1.5.1 (b0a9dd9c) on PATH. From the checkout root:

```sh
cd integration/local-console/registration
unshare -Urn sh -ec 'ip link set lo up; node test-stake-window.mjs'
```

The test starts a fresh loopback node and the actual paid-post reader, registers a name, and mines three calls in order. A wallet stakes 300, the author publishes, then the wallet withdraws its stake. The other staker holds 100 throughout. The reader must report credits of 3,750 and 1,250 respectively, and the transient wallet must have zero stake at both ends of the block. The command prints the new block and transaction hashes. Three negative controls cover a wrong recipient weight, misplaced receipt and conflicting block-end state. This test trusts the selected node for its historical state and receipts. It uses a separate chain from the downloadable PR #36 sample.

## Independent execution roots

Use the registration dependencies above, Node 20.20.2, Anvil 1.5.1 and the Linux Geth 1.17.10 `evm` tool (SHA-256 `d8cfddad15a8c601e7b069bc5973ad073dbc2d632b8c5ab50e513ef27c53d6da`). From the checkout root:

```sh
npm ci --prefix experiments/c007-transactions --ignore-scripts --no-audit --no-fund
export GETH_EVM=/absolute/path/to/evm
cd integration/local-console/registration
unshare -Urn sh -ec 'ip link set lo up; node test-stake-window.mjs --root-replay --compare-only'
unshare -Urn sh -ec 'ip link set lo up; node test-stake-window.mjs --root-replay'
```

The first command inside a namespace compares the execution engines. The second additionally requires agreement with every mined post-genesis header root. On November 23 the comparison succeeded and the strict check rejected blocks 5–15. Anvil also reported the empty trie root at genesis despite its funded accounts. Replay starts from the pinned ten-account funded allocation. The Shanghai fixture uses a funded block beneficiary and disables the default CREATE2 deployer. This is a fresh execution of the PR #37 scenario. The browser still uses its selected node.

Both engines computed `0xc72bc33605ce3958d5d3491915d068f5ec8a990d17de60cdf50d4a88f88ebe91` immediately after the post. Its author spent 5,000 fixture CAW, and recipients gained 1,250 and 3,750. The separate exit transaction returned 300 staked tokens. Both engines ended at `0xfa5685c725e5b492f08b9a7769788ff687f489918b9ca432cb1f76434248e1b3`; the selected Anvil header reported `0x8316f2efcc374d066e5e8ae862f0645eebf4a21a6c6f33e5c20f6cd7a0402feb`. Transaction and receipt roots, gas used and receipt blooms matched throughout.

The baseline post and payment checks still run first. If a supported window lacks evidence, the reader labels it unavailable. Inconsistent metadata or weights produce a conflicting-evidence label. Neither case displays a verified stake explanation. Mixed-case hex digits are accepted for canonical ABI calldata; trailing bytes are outside this supported shape.

## Why block 5 diverges

Run the `--root-replay --compare-only` command above. Its `firstMismatch` record prints the fresh block hash, transaction, registry, both raw storage keys and both pairs of roots. The strict command continues to reject the source header. This diagnosis applies to Anvil 1.5.1 and the pinned Shanghai fixture.

Block 5 transfers the username NFT to `0x0000000000000000000000000000000000001234`. Its registry is `0xe7f1725e7734ce288f8367e1bb143e90bb3f0512`. The verifier opens the account proof against each header, then the storage proofs against that account’s storage root. It decodes the raw leaves so that absence and an explicit zero remain distinguishable.

| Registry entry | Block 4 | Block 5 Anvil | Block 5 Geth / EthereumJS |
|---|---|---|---|
| Sender’s NFT balance (mapping slot 3) | 1 | Stored zero | Absent |
| Token approval (mapping slot 4) | Absent | Stored zero | Absent |

The recipient balance rises to one and the owner becomes the recipient. Both zero representations read as zero through normal storage calls. The verifier rebuilds the replay storage trie from Geth’s allocation and checks it against EthereumJS. Neither zero leaf alone reproduces Anvil’s storage root. Inserting both as the one-byte RLP value `0x80` reproduces it exactly. Replacing only the registry’s storage root on a separate copy of the replay world state reproduces the full block-5 header root.

- Replay world root: `0x70dcd697584c81d383333f1796f7e2d979c8595a97eb08f49c5b9e4daf26409a`
- Anvil world root: `0x98c3a14cc23e080a852e6a124596093ab397376398a02b3772e03ec4408d481c`

The live replay state is preserved for blocks 6–15. Matching a diagnostic copy at block 5 does not authenticate the later headers or change #37’s review status.

## How the difference changes through block 15

Run the same `--root-replay --compare-only` command above. Each `headerReconstruction` line prints the height, block hash, source and replay roots, and contract/slot pairs added, removed and still active. The `readOnly` list identifies active keys that EthereumJS observed being read but never written since the start of this fixture.

| Block | Explicit zero leaves absent from replay | Change since preceding block |
|---|---:|---|
| 6–7 | 2 | Both block-5 NFT entries persist. |
| 8 | 2 | Registering the next name restores the sender’s NFT balance to one. That difference disappears. Spending the registration allowance leaves an explicit zero in its place. The earlier NFT approval difference persists. |
| 9–13 | 2 | The NFT approval and registration allowance differences persist. |
| 14 | 4 | The persistent staker deposits its full fixture-token balance. Its token balance and its allowance to the pool both join the set. |
| 15 | 8 | The post payout restores the persistent staker’s token balance, removing that difference. Five entries join: the author’s and temporary staker’s allowances to the pool, the temporary staker’s stake, its vacated member-array element, and the author’s zero stake. |

At block 15 the pool reads the author’s stake to exclude it from eligible weight. The replay observed no write to that slot. Searching only zero writes missed it. Header-bound account and storage proofs establish exactly which raw leaves Anvil includes. For each height the verifier rebuilds each touched contract’s storage from Geth’s allocation, compares it with EthereumJS, and inserts only proven explicit zeros into a separate copy. Omitting any one produces a different contract storage root. Inserting the full set yields the exact Anvil world root at every height. The unmodified replay still rejects those headers; stake and credits retain the independently computed values above.

## Reproduce the published PR 37 trace packet

Use Linux x86-64 with Node 20.20.2, npm 10.8.2, Bash, Git, Python 3, curl, GNU tar, coreutils, iproute2 and util-linux. Both unprivileged user namespaces and network namespaces must be available. The checkout and npm installs need internet access. Each execution starts its own disposable node inside an isolated loopback network.

Download the immutable packet and verify its bytes before extracting:

```sh
set -eu
work=$(mktemp -d)
cd "$work"
curl -fL --retry 2 https://raw.githubusercontent.com/Xubu-Trad/cawmmunity.caw-decentralized-social/f0aacba2c93e0fbb2cc4e7eb5e789ef2365e69a1/evidence/pr37-block-trace-v1.tar.gz -o trace.tar.gz
echo 'f57da9b76859788bd1aedcbf3dafe0c70e76961747f775323b121ebde686cf2e  trace.tar.gz' | sha256sum -c -
tar -xzf trace.tar.gz
(cd packet && sha256sum --strict -c SHA256SUMS)
```

Fetch the pinned Linux tools, or use matching local binaries. Continue in the same shell:

```sh
mkdir tools
curl -fL --retry 2 https://github.com/foundry-rs/foundry/releases/download/v1.5.1/foundry_v1.5.1_linux_amd64.tar.gz -o foundry.tar.gz
tar -xzf foundry.tar.gz -C tools anvil
curl -fL --retry 2 https://gethstore.blob.core.windows.net/builds/geth-alltools-linux-amd64-1.17.10-1df30b18.tar.gz -o geth.tar.gz
tar -xzf geth.tar.gz -C tools --strip-components=1 geth-alltools-linux-amd64-1.17.10-1df30b18/evm
export PATH="$work/tools:$PATH" GETH_EVM="$work/tools/evm"
git clone https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social.git repo
git -C repo checkout --detach 68ee9ab52ebbf27827792318b54144c3fbf196a2
bash packet/reproduce.sh "$work/repo"
```

The wrapper hashes both executables, installs the three locked dependency sets, and compares fresh results with both reference files. It checks the exact slots, roots and credits. Fresh mining timestamps can change block hashes, so it checks those references within each run. The expected exit codes are 0 for the cross-engine comparison and 1 for strict header authentication with `SOURCE_HEADER_ROOT_MISMATCH`. The wrapper exits 0 only when both expected outcomes reproduce. Its first line gives the results directory containing the two JSONL traces, stderr and exit codes. For an independent operator report, include the tested commit, archive digest and those results.

## CAW token registration and settlement

From the repository root, use Linux, Node 20.20.2, Anvil 1.5.1 on PATH, iproute2 and unprivileged network namespaces:

```sh
npm ci --prefix integration/local-console --ignore-scripts --no-audit --no-fund
npm ci --prefix integration/local-console/registration --ignore-scripts --no-audit --no-fund
unshare -Urn sh -ec 'ip link set lo up; node integration/local-console/registration/test-caw-runtime.mjs'
```

The test starts its own disposable node, installs the captured 2,278-byte CAW runtime at the historical address, and seeds synthetic balance and supply slots. The registration candidate checks the runtime hash at construction and on Ethereum chain ID 1 additionally requires the historical token address. Code identity alone cannot authenticate a token’s ledger or deployment.

The run rejects a different runtime and a zero-address payment. It checks username NFT ownership, the exact sink credit, reduction of maximum allowance, ownership and length controls on publication, the 5,000-token staker credit, the 100-token stake withdrawal and unchanged supply. No real assets are used. The local posting pool remains bounded and chain-specific. This candidate does not establish testnet readiness or community acceptance of the sink.

## Social fees and NFT-account withdrawal

Run the [CAW runtime integration command above](#caw-token-registration-and-settlement). The same child node, token, NFT registry and posting pool serve all actions. First the author registers and publishes. A second username then likes and reCAWs that mined post and follows the author. The like uses the posting reader’s single-transaction block proof; the reCAW uses the author recorded by that verifier.

| Action | Wallet debit | Author or followed owner | Staker with 100 | Staker with 300 |
|---|---:|---:|---:|---:|
| Like | 2,000 | 1,600 | 100 | 300 |
| ReCAW | 4,000 | 2,000 | 500 | 1,500 |
| Follow | 30,000 | 24,000 | 1,500 | 4,500 |

For each row the run checks the action receipt, CAW transfer logs, both staker credits, the payer’s allowance, actual wallet balance changes and the recorded action. Social fees come from wallet allowances. Account custody uses a separate deposit keyed by the username NFT ID.

The runner deploys the existing account-custody probe against this registry and its runtime hash. It deposits 900, transfers the NFT, checks rejection of the former owner and stale ownership epoch using read-only calls, then mines a withdrawal of 900 by the current owner. The withdrawal receipt, actual recipient and vault balances, account credit and aggregate liability must agree. A second withdrawal must be rejected. The run prints transaction hashes; monetary fields named payerDebit, directCredit and amount on the withdrawal record use base units (18 decimals). The token storage setup is synthetic. The current browser readers still have fixture-specific assumptions.


## Choose a registration wallet

Open the local registration page, select a signing wallet and click **Connect local wallet**. A wallet that announces itself through EIP-6963 can appear alongside other wallets. The page also accepts an injected browser wallet. Changing the selection clears the account and quote. Reconnect and review the username price before signing. The chain ID and genesis checks still apply.

From the repository root, install the console dependencies with `npm ci --prefix integration/local-console --ignore-scripts`. With Python Playwright and its Chromium installed, run `python3 integration/local-console/registration/test-wallet-selection.py`. This checks selection, duplicate announcements, inactive-wallet events, active account changes and legacy fallback with browser test providers. The real-extension compatibility matrix and wallet selection on other action pages remain open.


## Use one wallet across the runtime deployment

From the repository root on Linux, install the two locked dependency sets and start the portal. Put Anvil on PATH first. This starts its own loopback-only disposable chain and seeds local balances. Keep the process running during the browser session.

```sh
npm ci --prefix integration/local-console --ignore-scripts
npm ci --prefix integration/local-console/registration --ignore-scripts
node integration/local-console/registration/test-caw-runtime.mjs --portal
```

Open **http://127.0.0.1:34736/**. Choose your disposable wallet, connect, get test funds and register an available eight-character username. On the same page, leave the username in place and choose **Use your username**. Supply a post body, original post transaction hash, target username, or amount as prompted. Review the signer, destination and fee. When an allowance is needed, approve the exact amount and review again before signing the action. A withdrawal requires credit in the NFT account. Deposit first to try it. Every successful submission shows its transaction hash. The legacy portals on separate ports use their own wallet handling.

For a fresh automated run, use the `post` hash printed by this launcher, belonging to `hunter01`. Install Python Playwright and its Chromium first. Use a newly launched chain for each signing run to replenish the limited faucet.

```sh
python3 integration/local-console/registration/test-wallet-browser.py --runtime-post POST_HASH
python3 integration/local-console/registration/test-wallet-selection.py
python3 integration/local-console/registration/test-wallet-extension.py /path/to/unpacked/metamask
```

The signing test chooses the second provider with a rejecting decoy installed and signs locally. It registers a username, reloads, then publishes, likes, reCAWs, follows, deposits 10 CAW and withdraws 10 CAW. The browser checks the mined sender, destination, calldata, value and block hash. The MetaMask check uses the installed extension code and a fresh profile with no existing wallet data. It checks wallet discovery, chain ID and authorized accounts. Real-extension transaction signing and independent reproduction are pending. Use Ctrl-C to stop the launcher.
