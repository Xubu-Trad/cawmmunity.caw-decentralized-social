# Use community.caw

## Check a real CAW balance

Save [caw-balance.html](../public/caw-balance.html?raw=1) and open it directly in your browser, or open the balance reader from either project landing page. Paste a public Ethereum address and select **Check balance**. The browser contacts PublicNode and dRPC when you submit. Both services receive the queried address. There is no wallet prompt, download of chain history or gas payment.

The reader checks Ethereum chain ID 1, pins both reads to one block hash, checks the CAW token’s deployed bytecode against its preserved digest, and shows the full 18-decimal amount only when both providers agree. The block number and hash are included so someone else can check the same result. This verifies agreement between two RPC services. It trusts their finality reports. [Live browser observation](../evidence/product-delivery-20261122/ethereum-balance.json).

To repeat the browser checks offline, install Python Playwright and Chromium as described in the [console setup](PAID_POST_PREVIEW.md). Run `python3 scripts/check-caw-balance-browser.py` from the repository root. To check the live path separately, open the downloaded reader, use a public address, and record the displayed block hash with the balance.

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
