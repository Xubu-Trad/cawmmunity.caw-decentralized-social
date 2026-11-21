# Check a console withdrawal offline

The local console can save the signed transaction, receipt, two adjacent local block headers, and the proofs for the owner, custody credit and token balances on either side of a withdrawal. A reviewer can check the file with the console and node stopped. This release covers a regular wallet or the fixed immutable-controller research wallet withdrawing mock tokens in a block containing one transaction.

## In the console

Open the saved withdrawal and choose **Verify saved action against history**, then **Download withdrawal proofs**. The download uses the evidence from that verification. Refreshing or changing the saved record requires another check. **Export saved receipt and rechecks** is still available for comparing what the browser recorded with what signed history shows. A discrepancy in the saved record remains visible.

## On a second installation

Use Node.js 20.20.2. Install the dependencies using the console's lockfile once. The verification command then needs only local files.

```sh
npm ci --prefix integration/local-console
node integration/local-console/verify-withdrawal-package.mjs withdrawal-proofs.json trusted-selection.json
```

Choose the selection separately. For your own run, record the expected transaction hash and amount, its block hash and the parent block hash from your selected local history, and the deployment's controller plus the addresses and runtime code hashes of the registry, posting, custody, token and wallet contracts. A reviewer who simply copies the selection out of the download accepts the exporter's choice of chain and contracts. [Example selection for the preserved fixture](../evidence/console-withdrawal-20261116/withdrawal-selection.json).

Exit 0 with `LOCAL_WITHDRAWAL_STATE_EFFECTS_VERIFIED` means the signature, inclusion, receipt and balance changes satisfy the existing reader for that selection. A different selected block or missing proof causes a nonzero exit. The checks establish consistency with the selected local headers. Public-chain finality, execution replay, mixed blocks and other contract wallets require separate evidence.

## Repeat the controls

From a checkout of the research branch with the dependencies installed:

```sh
node integration/local-console/test-withdrawal-proof-package.mjs
node integration/local-console/test-transfer-proof-completeness.mjs evidence/console-transfer-receipt-20261115
```

The package controls use two previously published local withdrawal captures, including the fresh capture under the November 16 evidence directory. They cover matching and mismatched selections, altered evidence, incomplete proofs and malformed files. The transfer controls cover a separate review finding: a proven registry transfer requires ownership-transition evidence before the reader can classify a saved transaction as absent. [Prior acquisition](../evidence/console-withdrawal-20261116/README.md) · [R-07 review](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/pull/19#issuecomment-6918751018).

The read-only console endpoint and the Chromium download produced identical 28,866-byte files for the preserved withdrawal. The CLI verified two mock units using the fixture selection published before this change. The browser run used controlled responses. The separate endpoint run acquired proofs from a recorded local chain. No new transaction was submitted in either test. [Results and file hash](../evidence/withdrawal-proof-export-20261118/results.json).

## Verify the withdrawal against a separately obtained checkpoint

Run `node integration/local-console/verify-withdrawal-package.mjs proof-package.json selection.json headers.json CHECKPOINT_HASH`. Supply the hash from a source you trust independently of the exporter. Provide Shanghai execution headers in ascending order from the block before the withdrawal through that checkpoint (2–129 headers). The reader recomputes each hash, checks each parent and height, and requires the second header to identify the withdrawal block. Its result establishes ancestry relative to the supplied checkpoint. Establishing that checkpoint’s finality is a separate step.

### Collect the headers from your own local node

Record the withdrawal's parent hash and the checkpoint hash from sources you select separately from the proof exporter. Your local Shanghai-compatible node must retain that history. From the repository root, with those values in `START_HASH` and `CHECKPOINT_HASH`, run the following in a fresh working directory for output, or choose a new filename:

```sh
node integration/local-console/collect-checkpoint-headers.mjs http://127.0.0.1:8545 "$START_HASH" "$CHECKPOINT_HASH" > reviewer-headers.json &&
node integration/local-console/verify-withdrawal-package.mjs proof-package.json selection.json reviewer-headers.json "$CHECKPOINT_HASH"
```

The first command follows parent hashes backwards and returns the verified headers in ascending order. The second binds the withdrawal to that history. A failed collection exits nonzero with no header data. Keep the checkpoint's source alongside the file. This procedure checks ancestry relative to that hash. Establishing finality still requires independent evidence.

Run `node --test integration/local-console/test-checkpoint-collection.mjs` to repeat the recorded-block collection and rejection controls.

### Repeat the two-node run

Use Python 3, the console dependencies installed from its lockfile, and the official Geth 1.17.10 build at commit `1df30b18d9ed35ee9d28ffd4648442c2204554ad`. Allow 2 GiB free and supply a new output directory under an existing parent. The recorded host ran Windows, Node 24.22.3 and the Windows amd64 archive (SHA-256 `ac22b491071b273d0da703e63112ede80c4bdd746ba579c812cb900f0d9cac5c`). [Geth releases](https://geth.ethereum.org/downloads/)

```sh
python integration/local-console/reproduce-withdrawal-peer.py --geth /path/to/geth --output ./withdrawal-peer-run
```

The helper computes an empty Shanghai block 15 from the archived block 14 with ethers. Its timestamp is the parent's timestamp plus one second. It writes the hash before starting either node. Only the source receives execution payloads. The receiver starts from genesis with its own database, initially has no checkpoint block, and receives a head hash and one peer. After syncing it supplies headers 13–15, the signed transaction, receipt and five account proofs on each side of the withdrawal. The offline reader checks them against the original selection, including the amount of two mock units. The output directory retains the checkpoint, headers, receiver proofs and result.

The first attempt timed out with both nodes limited to one peer slot. Allowing four slots connected one peer. Both successful runs returned the same header-file digest. The later run also reacquired the transaction, receipt and state proofs. Both nodes used the same Geth version on one host. This experiment creates a fresh descendant of the archived withdrawal. An independently operated historical checkpoint and public-chain finality remain open. [Compact result](../evidence/withdrawal-peer-checkpoint-20261119/result.json)

## Verify a withdrawal made through the fixture contract wallet

In the recorded transaction, the controller signed the wallet’s `execute` call. The wallet called custody to withdraw two mock units for account 2 at epoch 1. The token balance of the wallet rose from 0 to 2, custody fell from 10 to 8, and the account credit fell from 2 to 0. The verifier checks the signer, the exact outer and inner calls, the committed withdrawal event and the balances at both selected block hashes.

With the console dependencies installed, repeat the offline verification and substitution checks from the repository root:

```sh
node integration/local-console/verify-withdrawal-package.mjs evidence/contract-wallet-withdrawal-20261119/wallet-proofs.json evidence/contract-wallet-withdrawal-20261119/wallet-selection.json
node integration/local-console/test-fixture-wallet-withdrawal.mjs
```

The second command recompiles the fixture and inserts its controller at the compiler-reported immutable positions. Its runtime hash must match the hash proven for the wallet. The seven negative controls cover substituted authority, receipt and accounting evidence. To make a fresh capture with the same Geth release used for the two-node run, supply a new output directory:

```sh
python integration/local-console/reproduce-wallet-withdrawal.py --geth /path/to/geth --output ./wallet-withdrawal-run
```

This replays the preserved prefix through block 12 in a new local database and signs a withdrawal using the published disposable fixture account. It produces an alternative local block 13 before the original ownership handoff. Two runs produced proof-package SHA-256 `a55975a515af352331977e2eda57b9528de0b8d3243a04c180bbef4d5122600d`. The bundled selection reproduces this fixture. For a different history, record your own selection independently. Other wallet runtimes, mixed-transaction blocks and public-chain finality remain outside scope.

## Mixed-block withdrawal

From the repository root, use Node 20.20.2 and install the locked console dependencies. The published fixture is a disposable local chain. Its pins came from the same run.

```sh
cd integration/local-console
npm ci
node test-withdrawal-inclusion.mjs
fixture=../../evidence/mixed-wallet-withdrawal-20261121
node check-withdrawal-inclusion.mjs "$fixture/block.json" "$fixture/pins.json"
```

To mine another batch, run `python3 reproduce-wallet-withdrawal.py --mixed --geth /absolute/path/to/geth --output /fresh/output` using the Geth version and verified binary specified above. Replay its block and pins with the same offline command. For a separately anchored review, supply your own trusted header hash and expected transaction and participants. The fixture's signed sibling occupies index 0 and the selected withdrawal occupies index 1. The reader verifies the transaction and receipt roots, the signature, calldata and the withdrawal event at the matching index. Balance changes attributable to that individual transaction and public-chain provenance remain open.
