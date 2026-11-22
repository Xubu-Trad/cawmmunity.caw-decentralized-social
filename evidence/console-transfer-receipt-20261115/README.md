# ownership-transfer receipts bound to authenticated local history

baseline: `1dfe9d572c0ad69369fbe8c837a6936e3b16e0d0`.

## implementation

the console's **verify saved action against history** button now supports posting and ownership-transfer receipts. the strict ownership reducer's verified transfers are associated with their signed transaction hashes. the receipt binder compares sender, target, calldata, nonce, value, chain, prior owner, recipient and prior epoch, plus the saved receipt block/status and review anchor. an exported post hash cannot masquerade as a transfer receipt.

standalone transfer blocks now request the same recipient-code and final registry/posting proofs used for mixed transfer/post blocks. admission still requires strict transaction/receipt commitments, signatures, supported owner/receiver code, exact calldata/logs and final owner/epoch/post-nonce agreement. removing the old multi-transaction-only routing condition does not bypass those checks. unsupported callbacks, arbitrary contract wallets and withdrawal receipts remain rejected.

results distinguish matching transfer inclusion, inclusion with local-record discrepancies, absence from the selected verified transfer history, and rejected evidence. the original export/rechecks remain unchanged. the reviewed epoch is compared with reconstructed prior state; ERC-721 transfer calldata still has no expected-epoch precondition. this change does not add one or claim to solve that policy boundary.

## fresh execution

a fresh isolated Geth/browser journey submitted one post and then a standalone ownership transfer from the fixture wallet to the disposable recipient. the transfer at block `0xd`, transaction `0x77e2eb0bf2e22cb9ee98b02b4b7c47d0a8ddab0af7c292278c078b88dca91e74`, returned `INCLUDED_TRANSFER_MATCHES_LOCAL_RECORD`. reload verified it again without connecting a wallet or submitting another transaction. offline verification of the new capture independently exercised the same strict reader on this machine.

the final owner changed and epoch advanced to two; credited mock tokens remained two, custody tokens remained ten, and the post nonce remained one. the receipt checker still reports `accountingEffectsVerified: false`. these observed balances do not turn the entire saved accounting projection into a proven transfer effect. public-chain authentication, consensus and execution-replay flags remain false. services stopped normally.

15 fresh browser journey checks passed. another 13 transfer-binding controls cover exact identity, wrong recipient/epoch/nonce, mismatched receipt, post/transfer confusion, missing or altered boundary proofs and signed-byte/receipt tampering. 15 ownership-acquisition, 6 safe-owner, 13 posting-binding, 28 endpoint/panel and 14 browser regressions also passed: 104 scoped checks total. these are local tests, not an independent operator reproduction or production acceptance.

## reproduction

use Node 20.20.2 and the existing local-console lockfile. to check the fresh transfer evidence without a node:

```sh
node integration/local-console/check-receipt-history.mjs evidence/console-transfer-receipt-20261115/transfer-export.json evidence/console-transfer-receipt-20261115/review-state.json evidence/console-transfer-receipt-20261115/capture.json evidence/console-transfer-receipt-20261115/selection.json
```

copy the evidence directory to a fresh writable directory for controls; the transfer test writes a separate mixed-block export and fixtures there. run the endpoint test before the transfer test because the latter writes its own `transfer-export.json`:

```sh
node integration/local-console/test-console-receipt-history.mjs /absolute/path/to/fresh-evidence-copy
node integration/local-console/test-transfer-receipt.mjs /absolute/path/to/fresh-evidence-copy
node integration/local-console/test-owner-acquisition.mjs evidence/console-transfer-receipt-20261115/owner-evidence.json
node integration/local-console/test-safe-owner.mjs evidence/console-transfer-receipt-20261115/owner-evidence.json
```

expected: 28, 13, 15 and 6 controls. posting-binding regression used the unchanged `console-receipt-history-20261115` capture. the browser regression uses a fresh directory with this checkout in `src/`, `accounting-withdrawal.json` at the root and `CHROME_BIN` set; invoke `node --experimental-websocket integration/local-console/test-receipt-history-browser.mjs /absolute/path/to/fresh-browser-directory` for 14 checks.

to repeat fresh execution, use the previous [fresh console instructions](../console-fresh-receipt-20261115/README.md) and the unchanged `--receipt-history` launcher mode at this commit. that mode now includes the standalone transfer and its offline verification. it uses public disposable fixture keys and a controlled EIP-1193 browser adapter, not a real extension. existing guards and frozen reproduction inputs are unchanged.

## preserved fixture failure

the first endpoint regression failed with `RPC_RESPONSE`: its older recorded RPC fixture did not supply the additional proofs now requested for a standalone transfer. that failure log was retained. the adapter was extended to serve exact recipient and boundary proofs from the new fresh capture, and all 28 controls then passed. no missing-proof fallback or relaxed verification was added.

next: extend authenticated receipt verification to withdrawals with explicit custody/token state effects, rather than labeling a successful receipt as proof that the expected accounting occurred. independent reproduction, paid-post economics and public operation remain open.
