# Local account handoff and new-owner withdrawal

The local console can now hand the existing account 2 to another disposable wallet. The recipient can connect and withdraw the credit attached to that account. This is an application capability using the existing deployed research registry and custody contracts; no new contract runtime or economic rule was introduced.

## Behavior

1. Connect the current signer. Initially this is the controller of the fixture contract wallet.
2. Enter a disposable recipient address you control. Review account 2, the recipient and its attached credit. Give the recipient local test ETH for its later transaction fees.
3. Approve the transfer in your wallet. The original contract wallet calls the registry's existing `safeTransferFrom`. A plain current owner calls the registry directly.
4. After verification, connect the new owner and review a withdrawal. It calls custody directly, with the current ownership epoch, and receives the mock tokens at its own address.

The console requests no signature on load and never resubmits automatically. Both action types use one saved-record slot and exclusive browser lock. A transfer is saved before requesting the wallet. Reloading may resume verification, including with the previous signer connected for receipt recovery only. New actions still require the current signer. Successful transfer confirmation requires the exact nonce and transaction bytes, a matching local canonical block, and the registry's account-2 `Transfer` event with the reviewed sender and recipient.

Before a signature request, the console rereads owner, signer, epoch, selected contracts and credit; changed authority cancels the review. Recipient code is checked again. Zero, low reserved addresses through `0xffff`, the current owner and selected contract addresses are excluded. Other code-bearing recipients are unsupported by this console.

## Observed local result

Sixteen browser handoff checks passed against real signed Geth transactions. Account 2 moved from the fixture wallet to disposable key4, with epoch 1 to 2 and credit 2 unchanged. A reload and receipt RPC failure retained the transfer record without another submission. At the same selected block, the former wallet's withdrawal reverted with `OWNER`; the new owner's stale-epoch withdrawal reverted with `EPOCH`; the current-epoch call succeeded without changing state. The recipient then withdrew 2: final credit 0, recipient mock balance 2, original wallet 0, custody 8.

The existing 22-case withdrawal/reload journey also passes. There are 239 focused Node checks and 10 Python launcher methods passing. These are scoped results, not a full repository suite or independent operator reproduction. The first browser regression stopped on its old expected error wording before any action was submitted; that result remains preserved. Updating the expected wording did not change its rejection assertion.

## Reproduce

Use the setup in [LOCAL_EXECUTION_CONSOLE.md](LOCAL_EXECUTION_CONSOLE.md) on the PR19 research branch. Start a fresh local fixture for each browser journey; the tests consume its credit. With the isolated `ethers` dependency installed:

```text
node integration/local-console/test-handoff-browser.mjs PATH_TO_CHROMIUM_OR_EDGE http://127.0.0.1:4200 LAUNCHER_PRINTED_LOCAL_RPC NEW_EVIDENCE_DIRECTORY
node integration/local-console/test-browser.mjs PATH_TO_CHROMIUM_OR_EDGE http://127.0.0.1:4200 LAUNCHER_PRINTED_LOCAL_RPC ANOTHER_NEW_EVIDENCE_DIRECTORY
node --test integration/local-console/test-wallet-provider.mjs integration/local-console/test-withdrawal-plan.mjs integration/local-console/test-account-transfer-plan.mjs integration/local-console/test-withdrawal-journal.mjs integration/local-console/test-receipt-status.mjs
python3 -m unittest discover -s integration/local-console -p test_receipt_poll.py
```

The browser harness checks the selected genesis and loopback RPC, then uses only public disposable fixture keys 3 and 4. If needed, it funds key4 with local test ETH from key3 and records that setup separately from the two UI-approved transactions. It independently encodes the requested calls using ethers, checks final balances directly and closes its isolated browser profile. It does not install a wallet extension.

## Remaining boundaries

- Fixed account 2 and mock tokens; no public registration, username minting, production economics or real funds.
- Browser tests use a controlled EIP-1193 adapter. Actual wallet-extension compatibility and an independent builder's reproduction remain pending.
- Existing `safeTransferFrom` does not accept an expected epoch. Review-time checks do not prevent changes after signing, including a pending transfer becoming usable after ownership returns to its sender. Withdrawal itself enforces its epoch. No transfer epoch guarantee is claimed.
- Empty recipient code at a snapshot does not prove possession of its key or guarantee future code/delegation status. The operator must control the recipient. Arbitrary contract-wallet recipients and account abstraction are not supported here.
- The selected local node is trusted. Transaction/event checks do not provide cryptographic public-chain inclusion or finality. Browser storage is not a backup or an OS-crash durability guarantee; different-transaction cancellation/replacement recovery remains open.
- Paid posting exists in a different research candidate. It must be reconciled explicitly with this registry/custody lifecycle before being presented as the same protocol. This console does not submit social posts yet.

Compact evidence: [handoff result](../evidence/local-account-handoff-20261112/result.json), [withdrawal regression](../evidence/local-account-handoff-20261112/withdrawal-regression.json), [focused checks](../evidence/local-account-handoff-20261112/unit-tests.log).
