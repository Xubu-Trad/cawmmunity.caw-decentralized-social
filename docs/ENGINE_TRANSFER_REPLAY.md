# Bounded signed-transfer replay

FACT — the pinned EthereumJS 10.1.3 engine executed the [acquired local signed transaction](SIGNED_TRANSFER_FIXTURE.md) using the verified parent account witnesses and journaled account adapter. There is no injected bytecode: code comes from the verified witness. The transaction signature/hash and reconstructed block hash are checked. Nonce, balance, hardfork and block gas-limit validation remain enabled.

Three grouped cases passed:

1. The local legacy EOA transfer executes successfully. Sender, recipient and fee-recipient nonce/balance values match the independently acquired child proofs. Gas used, cumulative gas, receipt status, empty logs and bloom match the captured receipt.
2. Changing only the sender nonce in the overlay causes transaction rejection and leaves that deliberately modified starting state unchanged.
3. Changing only the sender balance to zero causes transaction rejection and leaves that deliberately modified starting state unchanged.

The two negative cases are intentional mutations after proof verification, solely to exercise validity enforcement. They are not claimed to be alternate proof-authenticated states. Each attempt uses a fresh adapter. The retained fixture is a local artificial-balance chain, not public-chain evidence.

The first replay attempt detected cumulative gas42000 instead of21000: runTx defaults to the supplied completed header's gasUsed as prior gas. For the verified index-zero transaction, the harness now explicitly supplies blockGasUsed=0. The original failure is retained; expected receipt values and validation rules were not weakened.

After the existing frozen dependency installation, run from `experiments/execution-engine`:

```text
node --max-old-space-size=256 signed-transfer-replay.mjs ../..
```

[Source](../experiments/execution-engine/signed-transfer-replay.mjs) and [result hashes](../evidence/ENGINE_TRANSFER_RESULTS.json). Existing guards and dependency versions remain unchanged. These three cases are separate from the previously recorded1241/1241 ordinary offline tests; unchanged application/reference modules were not retested this increment.

INFERENCE — this establishes a narrow cross-engine comparison for one acquired signed EOA transfer, including fees and nonce advancement. It does not certify the complete adapter or all inherited state-manager paths.

UNRESOLVED — no full post-state root is computed. The overlay retains original proof roots rather than claiming updated roots. There is no account creation/absence, contract-wallet execution, nonempty storage, execution-revert/refund comparison, public-chain authentication, finality or production acceptance. Network isolation was not independently enforced. Next test a missing required witness during transaction execution, require the whole attempt to remain unusable after rollback, and then expand to acquired contract execution with independently checked outputs.
