# Accounting and ownership reconstruction

## What passed

The draft PR #19 synthetic candidate now has a separate offline accounting model. Starting from constructor arguments and zero account state, it rebuilds deposits, approvals, staking, fee allocations, dust, withdrawals, ownership transfers and epochs from the 26 signed transactions. It matches **all 18 final snapshot fields** retained by the local lifecycle run. Eight reverted transactions have no modeled token/account effects. Their native gas/nonce effects are outside this model.

The checker pins the exact capture, compiler output and expected snapshot bytes. It regenerates header, transaction, receipt and sender verification from the raw capture before accepting the supplied verified-history file. Successful contract creation bytes must match the selected compiled artifacts; created addresses are derived from signed sender/nonce. Account initialization comes from constructor calldata, not the expected final snapshot. The final snapshot is used only for comparison.

Successful account operations check reconstructed owner/epoch, funds and allowances. Stake proofs/root are checked. The paid post checks its signed domain, reconstructed owner, epoch/nonce, validity window, text and root; calculated fee allocations and text must match both committed logs. The model checks token conservation, credit totals, stake backing and vault backing after successful transitions.

## Final state

Amounts below use the experiment's 10^18 base-unit display convention, not a claim about the original CAW token.

| Field | Reconstructed and snapshot-matched value |
| --- | --- |
| Account credits 1 / 2 / 3 | 1,000 / 10 / 10 mock units |
| Account stakes 1 / 2 / 3 | 1,000 / 3 / 8 mock units |
| Total liabilities | 1,020 mock units |
| Vault token balance | 1,020 mock units + 1 base unit |
| Pool dust | 1 base unit |
| Owners 1 / 2 / 3 | synthetic A / B / B |
| Ownership epochs 1 / 2 / 3 | 2 / 1 / 0 |
| Account 1 post nonce | 1 |

The stake root also matches. Full base-unit values and synthetic addresses are in [the result](../evidence/c007-accounting-20261108/result.json). Wallet balances and allowances are derived by the model but were **not separately compared with final RPC reads**. Only the 18 explicitly listed snapshot fields are comparison evidence.

## Negative controls

Ten controls reject: reordered ownership history, applying a failed withdrawal, omitting a successful withdrawal, substituting the withdrawal sender, changing a fee allocation event, changing a stake proof, changing a successful target, attaching logs to a reverted transaction, changing constructor code, and changing the expected final balance by one base unit. These are semantic-model controls on copied decoded records; they do not claim the modified records pass the cryptographic history reader. The previous nine raw-history rejection controls were also rerun successfully.

The first test attempt contained a no-op mutation (replacing an already-zero proof word with zero). That test correctly failed to observe rejection. The failed evidence was preserved; the corrected test changes the word to one. No verification rule was weakened. These are scoped checks, not a full test-suite run.

## Reproduce offline

Recorded Node 20.20.2; no additional packages. From the candidate branch:

```sh
node --max-old-space-size=256 experiments/c007-constructor/check-history.mjs evidence/c007-history-reader-20261108/acquired-history.json /absolute/path/to/new-history.json
node --max-old-space-size=256 experiments/c007-constructor/check-accounting.mjs /absolute/path/to/new-history.json evidence/c007-signed-constructor-20261108/execution/compiler-output.json evidence/c007-history-reader-20261108/acquired-history.json evidence/c007-accounting-20261108/expected-final.json /absolute/path/to/new-accounting.json
```

The model and checker are deliberately bounded to this 26-transaction experiment. Unknown successful operations reject. They are not a production event indexer or a complete EVM interpreter. The source and compiled bytecode are selected artifacts, not an independent compiler reproduction.

## Remaining proof boundaries

Matching the final local RPC snapshot is not a storage proof against the final header state root. Locally selected headers are still not an independently authenticated chain or finality proof. Failed receipts are trusted as already-checked committed status; their revert reasons are not independently executed by this model. The model does not emulate general uint256 execution, gas, native balances, arbitrary contracts or malicious token behavior. Signature recovery plus this synthetic ownership model does not establish real NFT authority.

Next: bind final account/storage reads to the selected final header state root, including wallet token balances, then compare those proven values with the reconstruction. Independent acquisition and endpoint trust remain separate gates. NFT admission, original-token compatibility, open-population economics, real wallets and release review remain unfinished. No policy adoption or deployment approval is implied.


## Final-state proof follow-up

The [new proof diagnostic](FINAL_STATE_PROOF_DIAGNOSTIC.md) accepts 18 of 20 storage fields but rejects two present zero-valued leaves from the local capture. Complete state verification remains false; no reader rule was weakened.
