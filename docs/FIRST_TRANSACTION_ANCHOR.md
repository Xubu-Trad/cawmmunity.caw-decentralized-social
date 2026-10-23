# First-transaction replay anchor

FACT — `inspectFirstTransactionAnchor(text)` is a separate opt-in reader. It binds a block's transaction at index zero to an adjacent parent header and its committed state root. It reuses header-chain hashing, complete body commitments and sender recovery; it does not introduce another cryptographic implementation or execute an EVM.

Input is exact JSON text, at most 1 MiB, with fields `schema`, `parentHeader`, `header`, `rawTransactions`, `selection`. Schema is `caw-first-transaction-anchor/1`. Selection has exactly `profile`, `parentHash`, `blockHash`, `chainId`, `transactionIndex`, `transactionHash`. Only canonical `transactionIndex: "0x0"` is accepted. The whole block body is required, even when selecting its first transaction. Unprotected legacy signatures are refused; supported envelopes remain legacy/type1/type2.

The reader verifies both selected header hashes, adjacency, the child's parent link, the full transaction root, chain-bound sender recovery and the selected first transaction hash. It exposes `parentStateRoot` as a commitment from the parent header. The caller still supplies the chain/header selection; this does not authenticate it.

UNRESOLVED — the parent root is not asserted to be the state immediately before the transaction. Fork-specific system operations may precede even transaction zero. Later positions require ordered replay and are rejected, rather than using the end-of-block root as a shortcut. Account/storage proofs, system transitions, code dependencies, EVM execution and trust anchoring remain separate missing evidence.

`parentStateAuthenticated`, `preTransactionStateVerified`, `systemTransitionsVerified`, `executionVerified`, `accountAuthorityVerified`, `erc1271Verified`, `consensusVerified`, `finalityVerified` and `productionAccepted` remain false. No provider call, wallet, deployment or automatic adoption is added.

## Verification

Eight tests reuse the retained signed-withdrawal capture: successful first-transaction binding; later/noncanonical positions; different transaction selection; endpoint substitution; altered parent root; missing body transaction; wrong chain; and injected authority/duplicate JSON fields. The initial test attempt used an unsupported parser limit and was preserved; the reader now uses the existing supported 1 MiB bound. All1191 Node tests across67files passed. [Validation](../evidence/FIRST_TRANSACTION_TEST_RESULTS.json).

```text
node --test tests/first-transaction-anchor.test.mjs
```

IDEA — next acquire and verify the accounts, storage and code needed for the selected execution against the parent root, then implement a separately bounded replay path with explicit fork rules. Missing dependencies must reject. This anchor is preparation for that work, not completion of historical wallet validation.
