# Run the green portal against your own node

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
