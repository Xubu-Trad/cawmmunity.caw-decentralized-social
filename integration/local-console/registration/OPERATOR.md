# Run the green portal against your own node

For the published PR #36 fixture, start with the [exact download and replay commands](../../../docs/PR36_OPERATOR_SAMPLE.md).

Use Linux, Bash, curl, Node.js 20.20.2 and npm. Use Geth 1.17.10 (commit 1df30b18) for the disposable-chain import. Obtain your Geth binary from a source you trust. No publisher browser, keys or wallet are needed for verification.

From the root of a clean checkout:

```sh
b=integration/local-console/registration
npm ci --prefix integration/local-console --ignore-scripts --no-audit --no-fund
npm ci --prefix "$b" --ignore-scripts --no-audit --no-fund
```

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
