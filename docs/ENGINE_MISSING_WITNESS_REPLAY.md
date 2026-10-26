# Missing-witness transaction failure

FACT — seven grouped cases passed on the pinned EthereumJS 10.1.3 engine with the acquired local signed-transfer fixture. This includes the earlier successful transfer/receipt comparison and nonce/balance refusal, three incomplete witness packages, and a fresh complete-package retry.

Each incomplete package removes exactly one account from both the dependency selection and witness list. The remaining proofs still verify. Transaction execution then rejects the missing account with the structured WITNESS_STATE_MISSING_ACCOUNT error code:

| Missing account | Account writes before failure | Completed state-manager reverts |
| --- | ---: | ---: |
| Sender | 0 | 1 |
| Recipient | 3 | 2 |
| Fee recipient | 5 | 1 |

After each rejection, adapter health and subsequent reads fail. Retrying the same attempt fails without further writes. Discarding it does not restore usability. A fresh adapter constructed from the complete proof package executes successfully and matches the acquired nonce/balance values for all three accounts.

These checks establish permanent rejection after missing evidence, including misses after writes. They count successful rollback callbacks; because failed state is intentionally unreadable, they do not inspect or certify the rolled-back internal balances. The fresh complete run is a new attempt, not revival of failed state.

The initial assertion incorrectly matched the structured error code against the human-readable error message. It now checks the error object's exact code field. The original failure is retained; no production behavior or rejection rule was changed.

After the existing frozen dependency installation, run from `experiments/execution-engine`:

```text
node --max-old-space-size=256 missing-witness-replay.mjs ../..
```

[Source](../experiments/execution-engine/missing-witness-replay.mjs) and [result hashes](../evidence/ENGINE_MISSING_WITNESS_RESULTS.json). Resource guards and engine dependencies remain unchanged. These seven cases include the preceding three replay cases; they are not seven new independent scenarios. The unchanged1241-test ordinary offline suite was not rerun or inflated.

UNRESOLVED — this remains a local EOA transfer with an experiment-local adapter. Full state-root computation, missing storage during signed contract execution, contract-wallet authority, account creation/absence and public-chain authentication remain open. No general StateManager certification or production acceptance is claimed. Next acquire a signed contract-call fixture with proven runtime code and storage, then compare execution results and test missing-slot rejection.
