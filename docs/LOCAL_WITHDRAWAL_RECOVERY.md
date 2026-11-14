# Saved local withdrawal recovery

The local execution console saves a withdrawal intent before asking the browser wallet to send it. A page reload can restore that intent and resume receipt checking. No signing keys are stored. The record includes the selected deployment, reviewed transaction bytes, sender nonce and returned transaction hash when available.

## User flow

After connection and review, approval saves the intent and sends the same explicit nonce to the wallet. A returned hash is saved. Pending or failed receipt reads keep that record and block another withdrawal. A matching successful or reverted receipt clears only that record. An explicit wallet rejection clears a request that was not accepted; other wallet errors leave the outcome unresolved.

If the page closes after the wallet broadcasts but before it returns a hash, the restored record says the outcome is unresolved. Find the transaction hash in the wallet's activity, connect the selected account, and choose **Verify this transaction**. The console checks the sender, destination, calldata, zero native value, nonce and selected chain context before attaching the hash. A matching receipt is still required to establish execution. It never automatically resubmits.

An older identical withdrawal cannot satisfy a later saved nonce. Current credit and ownership epoch may differ from the historical review; that is expected after execution. Recovery checks the saved transaction against the selected deployment and chain history, rather than treating today's balance as the earlier balance.

## Failure boundaries

- A missing Web Locks API or unsuccessful storage write prevents a new wallet request. Same-origin cooperating tabs serialize journal mutations and compare record IDs before updating or clearing them.
- Malformed, oversized or mismatched saved data blocks new submissions and remains available to inspect or copy. The console does not silently discard it.
- Browser storage is local, not a backup guarantee. Clearing site data, switching profiles/origins/ports or an OS/storage failure can lose the record. The saved-data panel allows a manual copy; never put a private key in it.
- If a wallet replaces/cancels a transaction using the same nonce but different bytes, this checker will not call that a successful withdrawal. General replacement/cancellation resolution is not implemented.
- An unresolved intent with no discoverable transaction remains blocked. The app does not infer that nothing was sent from silence or an empty transaction search.
- This remains a fixed-account, mock-token application on a local Geth chain. A controlled browser adapter is not an actual extension compatibility test. The RPC and retained deployment selection remain trusted; matching local receipts are not public-chain finality.

No contract authority, token supply, fee rule or specification decision is changed by this application feature.

## Executed validation — November 12, 2026

An isolated Edge browser with a controlled EIP-1193 adapter passed 22 cases against actual signed local Geth transactions. A reload after hash receipt restored verification without another submission. A second transaction broadcast while the adapter withheld its hash; a reload preserved the unresolved intent. The older, otherwise identical withdrawal was rejected because its nonce differed. The correct hash recovered and confirmed the second transaction. Two withdrawals left credit0, contract-wallet mock balance2 and custody8; exactly two transactions were submitted.

The browser also preserved the saved record on a receipt RPC error carrying code4001, distinguishing it from an explicit wallet-send rejection. Corrupt stored data blocked submission without being erased. 178 focused Node tests and 10 isolated Python test methods passed. These are local bounded checks, not independent builder reproduction, extension compatibility or production evidence.

The first new launcher run stopped on Geth's transaction-indexing-in-progress error. It is retained. The launcher now retries only that exact receipt response within its existing 100-attempt limit and records indexing delay separately from a null receipt; every successful bootstrap receipt must still match the sent hash and status1. Other RPC errors and malformed responses fail. The succeeding run used the revised helper.
