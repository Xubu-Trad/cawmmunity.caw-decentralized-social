# Batched local posting history

## Implementation

The console reader previously rejected every block containing more than one transaction. It now accepts up to16 transactions per block, subject to a deliberately narrow rule: a block with two or more transactions must consist entirely of successful, exact calls publishing posts for account2 through the selected posting contract or selected fixture wallet. Each receipt must contain exactly one posting event. Transaction/receipt roots, recovered signers, exact calldata, epoch, post nonce, text and parent-state proofs remain mandatory.

This is application history-reader work, not a change to deployed contracts, economics, registration or consensus. Mixed blocks remain rejected: an ownership transfer, unrelated transaction, failed transaction or additional log in a batch needs transaction-by-transaction state reconstruction. The reader cannot substitute block-start ownership for that missing evidence. Single-transaction blocks retain the existing behavior, allowing ownership changes between blocks. The16-transaction ceiling is a local resource limit, not a CAW specification rule.

The argument that a post-only batch cannot change the account owner depends on the selected, reviewed PostingResearch and fixture-wallet behavior. Runtime hashes and controller/layout selections remain trusted inputs; arbitrary contract wallets are not supported. No execution replay is performed by this reader.

## Evidence

Fourteen new checks passed: a two-post signed synthetic block; acquisition of both raw transactions and receipts; rejection of unrelated/missing/extra events, reverted status, duplicate nonce, a correctly signed different target, a different signer, an altered epoch and replayed calldata; and transaction/receipt resource boundaries. Adversarial vectors are re-signed or their roots/header recomputed as applicable, so the negative tests reach the named semantic checks rather than merely fail a damaged hash.

Existing15 strict-reader negative controls,12 console integration checks,11 interruption/recovery checks and340 wallet/action checks also passed. No new external reviewer execution is claimed. The16-entry bound was checked as a size boundary; a16-post cryptographically verified block was not generated.

**The new two-post vector is constructed, not mined.** Its parent and final proofs are reused from preserved local evidence, while new transactions, receipts, roots and a selected header are generated. It deliberately does not establish that the constructed transactions execute to that final state root. These tests verify the reader's acceptance/rejection logic under selected commitments; they are not chain execution or consensus evidence. The unchanged prior history regression uses the existing captured local history.

A fresh mined batch, a second execution engine and independent reproduction remain pending. No test nodes were started in this increment. The observed C: free space was about1.62GiB, below the existing2GiB node-start guard; no guard was changed. Lightweight offline and loopback reader tests ran without starting a chain node.

## Reproduction

Use Linux Node20.20.2 and the committed local-console lockfile. From a checkout containing this change:

```sh
cd integration/local-console
npm ci --ignore-scripts --no-audit --no-fund
node --max-old-space-size=256 test-post-batches.mjs ../../evidence/posting-history-20261113/capture.json ../../evidence/posting-history-20261113/selection.json
node --max-old-space-size=256 test-posting-history.mjs ../../evidence/posting-history-20261113/capture.json ../../evidence/posting-history-20261113/selection.json
node --max-old-space-size=256 test-console-history.mjs ../../evidence/posting-history-20261113
node --max-old-space-size=256 test-console-interruption.mjs ../../evidence/posting-history-20261113
```

This run reused the previous locked dependency installation. It was not another clean install. [Compact results](../evidence/post-batches-20261113/result.json) record the scope and source hashes. Earlier failed setup commands are retained locally; no rejected experiment was overwritten.

The [frozen53-file reproduction package](CONSOLE_HISTORY_REPRODUCTION.md) still targets03a2da and is unchanged. It does not cover this later batch extension. Reviewers can continue that independent reproduction without a moving target.

## Next integration gates

1. Capture two genuine posts in the same local block and compare their execution state with the existing independent engine.
2. Support mixed blocks only after reconstructing authority at each transaction; do not remove the post-only restriction to make acquisition pass.
3. Integrate a complete paid action only after choosing a separately identified experimental settlement interface. The current console custody fixture and legacy three-account paid probe are different contracts and economic models. They cannot be silently treated as one system. C-001/C-007 and production decisions remain unresolved.


## External evidence received

A reviewer has now supplied a genuine mined batch plus mixed/revert controls. Its archive hashes and unchanged-reader results were rechecked here; this was artifact corroboration, not another EVM run. [Pinned report, limits and next step](REVIEWER_FOLLOWUP_20261113.md). The earlier synthetic tests remain labelled as such.


## Fresh two-engine batch execution

A fresh local Geth batch is now replayed from its complete genesis allocation and preceding signed transactions in EthereumJS. All13transactions and13post-genesis state roots match; exact receipt logs/status/gas agree. This is a new block, not the external reviewer's block. Three corruption controls reject and the unchanged strict reader reconstructs both posts with eight negative controls. [Package, commands and boundaries](../evidence/post-batch-replay-20261113/README.md). Independent-operator reproduction is still pending. Mixed blocks and the existing oversized setup-transaction strict-reader boundary are unchanged.


## Experimental owner/post block verifier

The new verifyOwnerPostBlock entry point supports direct fixture-owner transfers and posts with beginning/end state proofs. It has fresh local execution and second-engine evidence. It does not alter verifyPostingHistory or console acquisition; arbitrary mixed blocks are still rejected there. [Exact scope and tests](../evidence/owner-post-block-20261113/README.md).


## Console integration update — November 13

Superseding the earlier separate-verifier status: console acquisition now supplies recipient account proofs and final registry/posting proofs for mixed ownership-transfer blocks. verifyPostingHistory validates those blocks using verifyOwnerPostBlock and checks nonce continuity across the history. Unsupported mixed actions still reject. Existing post-only and single-action history paths are unchanged. [Scope, commands and recorded results](../evidence/owner-acquisition-20261113/README.md).
