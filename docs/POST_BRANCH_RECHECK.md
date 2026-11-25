# Check an archived post against a later checkpoint

A post’s signature and receipt still verify if its block is replaced. To see whether that block belongs to a particular history, keep a later block hash (the checkpoint). The reader walks from that hash through the parent headers to the post height and compares the block found there with the archived block.

## Try both outcomes offline

From the checkout root, install the reader dependencies once. The two verification commands then run without network access.

```sh
npm ci --prefix integration/local-console --ignore-scripts --no-audit --no-fund
b=integration/local-console/registration
s="$b/samples/branch-check"
block=0x81473ce06a2add0ef448b70e2cbca60f0b557eebbde2345fb147ec04e69e2a0d
tx=0xa7145ef7bbc6e88cf0db0824b8e3b635dba8d5834b2865570d5c625c130066d7
first=0x2dadeb7d3f612c522e71ec1e7936119aaef8eb90d97299b271de015a5d5ede0a
second=0xd538d60819b9cfd6311861f844f249de6da16cb3e918c04bd06d5991d616941b
node "$b/recheck-post.mjs" verify "$block" "$tx" "$s/archive.json" "$first" "$s/included.json"
node "$b/recheck-post.mjs" verify "$block" "$tx" "$s/archive.json" "$second" "$s/different.json"
```

To check the sample files before running the reader, run `sha256sum "$s"/{archive,included,different}.json` in Bash. The expected SHA-256 digests are:

| Sample file | SHA-256 |
| --- | --- |
| `archive.json` | `56a0953dff9505d141f3f3ba8241707a0142373bc38903f0e36a8dc18e12cc98` |
| `included.json` | `c5a1198933753db11cbd0a30229e16981dc77b8f4d2e0cdeedb115d649f4f7fd` |
| `different.json` | `339e6cf8e4039a44f86c6b75a30d66afeea2a317edbad41d7c5d124926205356` |

Both checkpoints are at height 37. The first resolves to the archived block at height 35 and returns `included`. The second resolves to `0x8e5db22192e046458eec1234c036d45cbe697e0d0959fb65b185171e8719e0ae` at height 35 and returns `different-block`. Both are successful checks. In a script, read the JSON `status` field. Invalid or missing evidence stops the command with a nonzero exit.

## Recheck your own archive

Retain the original archive and both of its expected hashes. Obtain a checkpoint hash independently if you want independent evidence of the branch. Supply a loopback RPC that retains the intervening headers:

```sh
node "$b/recheck-post.mjs" capture "$RPC" "$POST_BLOCK" "$TX" post.json "$CHECKPOINT" branch.json
node "$b/recheck-post.mjs" verify "$POST_BLOCK" "$TX" post.json "$CHECKPOINT" branch.json
```

Capture writes a separate header file and rechecks the checkpoint against the node at its height. Both commands verify the archived post. The checkpoint must be 1–127 blocks later than the post. The header file therefore covers 2–128 consecutive Shanghai headers, counting both endpoints. The offline result applies only to the supplied checkpoint. A different block at the post height leaves open whether the transaction was mined elsewhere. Two independently created local chains can also disagree. The published example’s checkpoint hashes come from the fixture operator.

To reproduce a branch change, install both dependency sets and Anvil as described in the [operator guide](../integration/local-console/registration/OPERATOR.md). Run `node integration/local-console/registration/test-caw-runtime.mjs --reorg-post`. The fixture uses a disposable node snapshot to replace the post block, then closes the node before verifying the saved post against both branches.
