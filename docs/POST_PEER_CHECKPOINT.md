# Locate an archived paid post on a separately synced Geth node

A signature identifies the transaction. To find out whether a staker received CAW on a particular branch, check the receipt from that branch. This workflow does both with the exact signed transaction in the [PR #44 archive](../integration/local-console/registration/samples/branch-check/archive.json).

## What the receiver checked

Two Geth 1.17.10 processes started with empty databases and the same disposable genesis. Only the source received the signed setup transactions and the archived post. The receiver got one peer and a fork-choice hint for height 38. It synced and executed the intervening blocks. After the source stopped, the reader asked the receiver for height 37 by number, obtained its hash and located the post. The saved evidence also works after both nodes stop.

| Verified item | Original archive | Receiver's history |
| --- | --- | --- |
| Post | `hunter01` · `post before branch replacement` | Same signed bytes, signer, username and text |
| Post height | 35 | 35, different block hash |
| Total fee | 5,000 CAW | 5,000 CAW |
| Staker ending in `79C8` | 5,000 CAW at weight 100 | 2,000 CAW at weight 200 |
| Staker ending in `b906` | No credit in this receipt | 3,000 CAW at weight 300 |

This replay starts a new chain. The original height-37 branches contain repeated timestamps that Geth rejects. The replay places the original CAW runtime and initial token storage in genesis and uses increasing block times. Five setup transactions reverted in this history (heights 20, 22, 24, 30 and 31). The like and reCAW carried a header from the earlier chain. The follow and two unstakes ran out of gas during their CAW transfers. The two stakes therefore remained active before the post. The post at height 35 succeeded and its receipt identifies both payments. [Original headers and timestamp rule](POST_BRANCH_RECHECK.md#what-the-original-branch-examples-establish)

Both processes ran under one operator. Peer synchronization demonstrates a separate execution and data path. The shared genesis and source-supplied head hint remain trust choices. Independent operator checkpoint selection and public finality remain open.

## Verify the saved receipt offline

Use Node.js 20.20.2. From the checkout root, install the locked reader dependencies once. Set the block and transaction hashes from the original archive and the checkpoint hash from the receiver. A reviewer who retained their own checkpoint can use that hash directly.

```sh
npm ci --prefix integration/local-console --ignore-scripts --no-audit --no-fund
b=integration/local-console/registration
s="$b/samples/peer-check"
block=0x81473ce06a2add0ef448b70e2cbca60f0b557eebbde2345fb147ec04e69e2a0d
tx=0xa7145ef7bbc6e88cf0db0824b8e3b635dba8d5834b2865570d5c625c130066d7
checkpoint=0x3ae8c74183bc3aae8e9e2dd27aad137ac6960f33d745a4ecd3c7ef61c68d06ae
node "$b/locate-archived-post.mjs" verify "$block" "$tx" "$b/samples/branch-check/archive.json" "$checkpoint" "$s/located.json"
node --test "$b/test-locate-archived-post.mjs"
```

Read `original.status` for the original block's membership and `located.status` for the signed transaction's inclusion. Expect `different-block` and `included` respectively. Compare `archivedPost.credits` and `post.credits` for the settlement recorded in each block. The two archives and their header paths validate the transaction, receipts and membership. The sync process and its observed heights are recorded in `result.json`.

The pinned input SHA-256 is `35b8fc2707e45114b75bb3e7e0119d82a4a05249438067f4b579d51109dfae9b`. The receiver packet is `15410c7fa41b6e127c92ef4562f47ef1483f6670cdc63d9016fb78e78dc20ea0`. Check them with `sha256sum "$s/input.json" "$s/located.json"`.

## Repeat the peer sync

Use Linux, Python 3 and Geth 1.17.10 at commit `1df30b18d9ed35ee9d28ffd4648442c2204554ad`. Allow 2 GiB free. The published Linux amd64 Geth archive used for this run has SHA-256 `e016aca8cc391c8d5d14dc17c9af589488d99c37ed71d892213c80757935ba64`. Use a trusted binary from the [Geth downloads page](https://geth.ethereum.org/downloads).

```sh
# From the checkout root, with b and s set as above.
tmp=$(mktemp -d)
python3 "$b/reproduce-peer-post.py" --geth "$(command -v geth)" --input "$s/input.json" --output "$tmp/peer"
```

The output directory must be new. It contains the two node logs, the receiver evidence in `located.json` and the checked results in `result.json`. All nodes bind to loopback. The input contains already-signed disposable-chain transactions. To regenerate the setup input, install the registration dependencies from the [operator guide](../integration/local-console/registration/OPERATOR.md), put Anvil on PATH and run the command below. A fresh setup can produce different proof-bearing transactions and block hashes. The original selected post bytes must match exactly.

```sh
CAW_PEER_POST_INPUT="$tmp/fresh-input.json" node "$b/test-caw-runtime.mjs"
```

## Use a checkpoint from your node

For the supported disposable chain and Shanghai headers, supply a local RPC and a height in canonical hexadecimal. The checkpoint must be 1–127 blocks later than each post block being checked. The reader checks the selected height again before saving. Keep the checkpoint hash printed by capture separately for later verification.

```sh
node "$b/locate-archived-post.mjs" capture "$RPC" "$block" "$tx" "$b/samples/branch-check/archive.json" 0x25 "$tmp/receiver.json"
```

A missing receipt gives an unknown post location (`located: null`). Inconsistent evidence, unavailable ancestors or a changing checkpoint stop capture. The original archive and any re-mined receipt are verified independently against their own block commitments.

## Rebuild a feed of archived paid posts

Use the variables from the offline example above. Give the reader one checkpoint hash and a group of four arguments for each post. It checks all groups before printing a result. Up to 32 original posts can be checked together.

```sh
node "$b/recheck-feed.mjs" "$checkpoint" "$block" "$tx" "$b/samples/branch-check/archive.json" "$s/located.json"
node --test "$b/test-recheck-feed.mjs"
```

The current feed is sorted newest first, including transaction position within a block. A re-mined transaction appears once with its current receipt. An unlocated transaction stays in the unresolved list and contributes no current credit. Duplicate transactions, conflicting checkpoints and invalid evidence stop the whole rebuild. This command projects the supplied paid posts. Automatic discovery of omitted posts and reCAW rollback remain open.

The two-node launcher now requires explicit loopback bindings and checks the actual TCP listeners of both processes. Both fresh nodes passed the listener check. The complete stock replay on ec14b96 also reproduced the published receiver packet byte for byte.

## Check saved payouts in the green portal

Open **Recheck saved payouts** from the green portal or **Recheck saved posts and payouts** from the following feed. Choose **Try published example** to verify the original archive and receiver packet. For a re-mined post, the page shows each staker's current credit and the original receipt underneath. An unresolved row keeps the transaction and original block visible with no current payout.

To check your files, select the original archive JSON and its location packet JSON together, enter your trusted checkpoint hash, and choose **Verify feed**. Multiple posts may share one block archive. The portal accepts up to 32 selected posts and a combined request of 1 MiB. On a connected portal, choose **Get fresh receipts from the local node** and enter the later checkpoint height in hex. The saved packets identify the original selections. The node supplies the new evidence. On its final read, the portal checks both the block hash and the block number. A mismatch clears the whole batch, including any previously displayed payouts. Recheck explicitly whenever you change checkpoints.

For the standalone portal run these commands from the checkout root. The same page is built into the operator feed service on the same port. Run one server at a time.

```sh
npm ci --prefix integration/local-console --ignore-scripts --no-audit --no-fund
node integration/local-console/registration/checkpoint-portal.mjs
```

Open **http://127.0.0.1:34742/checkpoint**. To enable fresh reads on the standalone server, append the HTTP URL of your own loopback disposable node to the launch command. With the server running, use `python3 integration/local-console/registration/test-checkpoint-portal.py` for the Chromium checks. Add `--live` for the published Geth receiver history.

With the disposable runtime test dependencies installed (including Anvil, Python Playwright and Chromium), run the connected batch regression from the checkout root:

```sh
node integration/local-console/registration/test-caw-runtime.mjs --checkpoint-height
```

The browser verifies one post and then two posts. For each batch, the test repeats the request with the same hash and a wrong block number on the final read. The portal must report the height conflict and clear every payout.

Add `--watch-following` to the command to cover automatic discovery and polling. The browser checks conflicting heights on the first and last head reads and a publication log whose height disagrees with its authenticated header. It also starts with visible payouts and checks that a conflicting poll clears them. The existing chain-change test then exercises removal and re-mining with updated credits.

The automatic watcher also checks event discovery against the selected header chain. The browser test withholds one mined post while keeping the other search results, then restores it on the same chain. It separately withholds the follow that makes the author visible. Either omission must clear the feed. See the [operator guide](../integration/local-console/registration/OPERATOR.md) for the branch and size limits.

In browser mode the archived Follow reverted. The fixture preserves that receipt, funds the current reader01 owner, approves the fee and mines a successful Follow before synchronization. Each setup receipt must succeed. The resulting browser checkpoint is at height 40. The three setup transaction hashes are saved in result.json for comparison.
