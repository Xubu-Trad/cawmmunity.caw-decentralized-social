# Independent signed-transaction execution

The draft candidate now uses EthereumJS VM `runTx` to execute the **26 original signed transaction byte strings**, with normal signature, chain, nonce, balance and gas validation. No skip-validation flags are enabled. The retained result is **18 successes and eight expected reverts**, with exact log, receipt-bloom and gas comparisons against the local capture.

This replaces the transaction-processing limitation of the earlier [call-only experiment](INDEPENDENT_CALL_LIFECYCLE.md) for this bounded transaction set. It does not replace or rewrite that older evidence.

## Accounting and proof results

- Total gas spent: **7,905,511**, matching the captured receipts transaction by transaction.
- Base-fee burn: **3,580,134,994,853,564 wei**.
- Fee-recipient income: **12,230,887,005,146,436 wei** (the local capture uses the zero address as coinbase).
- The three synthetic funded senders' balances match a separate running gas-charge calculation after each transaction. Sender balances plus fee-recipient balance plus burned fees equal the selected initial allocation.
- Final proofs verify **20 contract-storage fields** and **four native accounts**, including both zero-valued storage fields as absence proofs. Custody, staking, ownership, epochs and post nonce still match the accounting model.

Native balances are compared with arithmetic from the selected initial allocation and verified gas/fee context, then proved against the new local execution root. They were not independently compared with Anvil's final native-account RPC responses. Full base-unit balances, nonces, root and controls are in [the result](../evidence/c007-full-transactions-20261108/result.json).

Seven negative controls reject: a changed storage claim, a missing slot, a changed proof node, substituting the original Anvil root, reusing a spent nonce (without changing state), an unfunded sender, and a wrong chain ID.

## Exact boundary

The existing readers first verify captured header links, complete transaction/receipt roots and recovered senders. The VM parses the original signed bytes and independently checks the sender. Initial native funding comes from the explicitly selected synthetic genesis allocation. Contract code and storage are created through those transactions; no final contract state is injected.

Each transaction runs under a block context carrying the captured number, timestamp, gas limit, base fee, fee recipient and randomness. This is **not full block processing or validation**: header ancestry/consensus, base-fee progression, withdrawals, system transitions, block rewards and a complete original-genesis reconstruction are not reproduced by this harness. There is one captured transaction per block. The final state root belongs to this independent local execution, not the original Anvil header. The original included-zero proof failures remain preserved.

## Reproduce

Recorded Node 20.20.2, EthereumJS packages pinned to 10.1.3. An isolated dependency installation completed with lifecycle scripts disabled; the lock file is retained. Use the [existing local capture procedure](FINAL_STATE_PROOF_DIAGNOSTIC.md) to generate an execution directory containing `acquired-history.json` and `compiler-output.json`, then copy the selected synthetic `genesis.json` into that directory. The genesis allocation must be the one used for the capture.

```sh
cd experiments/c007-transactions
npm ci --ignore-scripts --no-audit --no-fund
node --max-old-space-size=256 reexecute-transactions.mjs /absolute/path/to/capture-inputs /absolute/path/to/new-output
```

The output directory must not exist. The run writes a summary and detailed transaction roots, gas/refunds and storage/native proofs. The public package retains code, lock and summary; detailed execution records remain in the local immutable evidence lane. No server or public-chain transaction is used. The runtime was bounded to 256 MiB Node heap, 512 MiB RSS and 180 seconds. No new full repository test-suite result is claimed.

## Next gate

Define and reproduce complete genesis and block-level execution, then compare receipts and final state across the independent replay and a canonical capture. Keep block and consensus validation claims separate from these passing transaction checks. Independent endpoint trust, NFT admission, original-token compatibility, open-population economics and production review remain open. PR #19 remains draft and stacked on #18.
