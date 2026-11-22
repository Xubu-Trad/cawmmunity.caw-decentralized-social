# Use community.caw

## Check a real CAW balance

Save [caw-balance.html](../public/caw-balance.html?raw=1) and open it directly in your browser, or open the balance reader from either project landing page. Paste a public Ethereum address and select **Check balance**. The browser contacts PublicNode and dRPC when you submit. Both services receive the queried address. There is no wallet prompt, download of chain history or gas payment.

The reader checks Ethereum chain ID 1, pins both reads to one block hash, checks the CAW token’s deployed bytecode against its preserved digest, and shows the full 18-decimal amount only when both providers agree. The block number and hash are included so someone else can check the same result. This verifies agreement between two RPC services. It trusts their finality reports. [Live browser observation](../evidence/product-delivery-20261122/ethereum-balance.json).

To repeat the browser checks offline, install Python Playwright and Chromium as described in the [console setup](PAID_POST_PREVIEW.md). Run `python3 scripts/check-caw-balance-browser.py` from the repository root. To check the live path separately, open the downloaded reader, use a public address, and record the displayed block hash with the balance.

## Read a published post by transaction hash

You can recover a post on a second computer using the transaction hash. The reader needs the signed transaction, its receipt and the state proofs from the selected C-007 research chain. You can supply those from a node you operate, or start with the small recording included here. The reader verifies both sources locally. Neither path needs the publishing browser, its saved review or a wallet.

### Try the recorded post

From the repository root with Node.js 20.20.2 installed, run these commands. The install uses the console's dependency lockfile. After installation, the example runs offline.

```sh
cd integration/local-console
npm ci --ignore-scripts
node published-post-reader.mjs --serve
```

Open the address printed by the command. It includes the example transaction hash and opens directly to the post. You can also verify it from the terminal in the same directory.

```sh
node published-post-reader.mjs 0xd0051e7a446441a8aa7156367b7381b96dfe5ffb11b7ed4307a9b7b38ce1fd6b
```

The expected text is **reviewed through the local signing desk**, mined in block **18** with a fee of **5,000 mock tokens**. The recorded [13 node responses](../evidence/published-post-reader-20261122/proof-reads.json) contain the signed transaction bytes, receipt, headers and state proofs. Their verification is anchored to block hash `0x4593ebc25b268c60d078d9d392f745a6ce9d308c41cea77604180722685c3bc0`, published [with the original receipt on PR #30](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/blob/10003e65a829f40111c0c09c53c5927ae433c99a/evidence/product-delivery-20261122/receipt.json). The pinned block identifies a particular research-chain history. [See the reader](../evidence/published-post-reader-20261122/reader.png).

### Read another post from your node

Start the reader with `node published-post-reader.mjs --serve --rpc http://127.0.0.1:PORT`, replacing PORT with the port of your own C-007 archive node. Open the printed address and paste the transaction hash. The publishing console also links to the reader. A shared link carries the hash in its fragment. Another operator can paste that hash into their own reader. A loopback link only opens a service on the machine where it is used.

The reader reconstructs the text and signing request from the transaction bytes. It checks the sender, the post signature, the transaction and receipt roots, both publication events, and the fee, credits and rounding against the parent and settlement state proofs. The interface identifies the post signer separately from the wallet that submitted the transaction. A reverted call produces no published post. A missing receipt stays unverified. Live verification follows the selected node’s view of the canonical block.

The hash reader covers the fixed C-007 contracts and up to 16 transactions when each sibling is a successful, empty-data native self-transfer with a 21,000 gas limit. Ethereum mainnet paid posting, independent public finality and fee attribution alongside other custody-changing calls remain open. To repeat the reader controls after installation, run `node --test test-recorded-post.mjs`. The recording can be regenerated from a matching live node with `node published-post-reader.mjs HASH --rpc http://127.0.0.1:PORT --capture NEW_FILE`.

The [maintainer run log](../evidence/published-post-reader-20261122/checks.log) includes two historical posts sent by one relayer on behalf of different signers, and a reverted call with no published text. The standard 32-block replay now covers all three. To repeat the time-boundary check, run `python3 reproduce-paid-post-live.py --geth /path/to/pinned/geth --output /new/output --inclusion-time-test` from `integration/local-console`. It signs a post for a validity window starting at 20 and proves successful inclusion at 20 after a parent timestamp of 19. Independent operator reproduction remains open.

## Publish a paid post on the research network

Start the [signing desk](PAID_POST_PREVIEW.md#run-the-signing-desk) with the pinned Geth binary, Node 20.20.2 and a fresh output directory. The launcher starts the ordinary account console and a separate disposable C-007 node at block 17. It produces a new block when a fixture controller sends a transaction. Use the printed **Paid-post wallet RPC** with its disposable controller.

1. Enter the post and a validity window in fixture time, for example 0 through 1000 at block 17. Inspect the text, 5,000 mock-token fee, the two shares and the rounding remainder.
2. Connect the displayed controller and approve the typed-data signature. To publish, use the separate submission button and confirm the transaction in the wallet. This sends the exact post text to the fixed fixture contract.
3. Check the receipt. You can reload first. The browser retains the review, transaction hash when available and hash of the exact call. If the wallet response is interrupted, paste the hash from its activity and check again. The console never automatically sends a replacement.
4. A settled receipt identifies the included transaction, signer, block and exact published text. The verifier checks the transaction and receipt roots, both emitted events and header-bound state before and after the payment. It currently requires a block containing only the selected transaction and at most 128 blocks between the reviewed and mined history. An unsupported block stays unverified. The independent block hash/finality of a public network is outside this fixture.

### Repeat the browser publication

With the freshly started fixture still at block 17 and Playwright 1.58.0 with Chromium installed, run the following from the repository root. Replace the two ports with the ones the launcher printed.

```sh
python3 integration/local-console/test-paid-post-browser.py --submit --console http://127.0.0.1:CONSOLE_PORT --rpc http://127.0.0.1:PAID_RPC_PORT --output /absolute/path/to/new-browser-result
node integration/local-console/test-paid-post-settlement.mjs http://127.0.0.1:PAID_RPC_PORT /absolute/path/to/new-browser-result/receipt-request.json
```

The browser fixture uses a public disposable signer. It signs once, sends once and reloads before checking settlement. Repeating from genesis requires a new session. Never fund these fixture accounts with real assets. [Browser result](../evidence/product-delivery-20261122/result.json) · [Mined receipt](../evidence/product-delivery-20261122/receipt.json) · [Conflicting-evidence controls](../evidence/product-delivery-20261122/settlement-controls.log) · [Terminal view](../evidence/product-delivery-20261122/published-post-1440.png).

### Independent review status

The reviewer independently verified the scoped results of [#26](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/pull/26), [#27](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/pull/27) and [#28](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/pull/28). [#29](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/pull/29) received a final wallet-context recheck at `cb7521f`. [#19](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/pull/19) received bounded browser startup handling at `55ec2df`. Both fixes and the new mined-post delivery await independent review.

## Mixed-block post accounting

The selected post was transaction 2 of 3 in block 18. Both neighbors were signed native self-transfers with empty calldata and exactly 21,000 gas. Under the fixture’s Shanghai rules they have no execution gas for a contract storage write. The hash reader verifies the complete ordered transaction and receipt roots, recovers each sender and checks each sibling before attributing the parent-to-block custody changes to the post. A block with another contract call stays unsupported.

In raw units the payer spent 5000000000000000000000. Account 2 gained 1363636363636363636363, account 3 gained 3636363636363636363636, and 1 unit went to rounding. Token backing stayed constant. [Node responses and run log](../evidence/mixed-post-20261122/).

From the repository root, after installing the console dependencies, run `node integration/local-console/test-mixed-post-recording.mjs` for offline verification. For a fresh chain, run `sh integration/local-console/review-paid-post.sh --mixed-post-test --geth /path/to/pinned/geth --output /new/output`. The new directory contains the proof responses used by the verifier. Independent reproduction remains pending.
