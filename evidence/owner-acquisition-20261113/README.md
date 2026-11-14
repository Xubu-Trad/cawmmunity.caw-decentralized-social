# Console acquisition for ownership-aware posting

The console now acquires recipient account proofs and end-of-block registry/posting proofs for supported blocks containing an account transfer plus another action. These addresses come from untrusted receipt hints; only full header, transaction, receipt, signature, calldata, event and state-proof verification can accept the history. There is no partial acceptance before completion. Additional requests use the existing request/byte/time budget and cancellation path.

The existing history reader incorporates the bounded owner/post verifier for these blocks. The expected posting nonce must match the previously reconstructed history. Unknown actions, unsupported wallets, approved-delegate transfers and reverted actions remain outside the new mixed-block path. Blocks without a mixed transfer retain the existing reader, including its separate transfer/withdrawal scope. This is not general execution verification of every non-post transaction.

## Evidence and reproduction

Baseline before this integration: 13518d6fc44b8b51ba70a6fda8a761df55745aa2. The input is the previously published `evidence/owner-post-block-20261113/owner-post-evidence.json`: a genuinely mined local transfer followed by a new-owner post in block13. Its fresh Geth and second-engine execution records are in that directory; they were not rerun for this acquisition change.

Use a checkout of the exact commit containing this document, Node20.20.2 and the existing local-console dependency lock. From repository root:

```sh
npm ci --prefix integration/local-console --ignore-scripts
node integration/local-console/test-owner-acquisition.mjs evidence/owner-post-block-20261113/owner-post-evidence.json
node integration/local-console/test-posting-history.mjs evidence/posting-history-20261113/capture.json evidence/posting-history-20261113/selection.json
node integration/local-console/test-console-history.mjs evidence/posting-history-20261113
node integration/local-console/test-console-interruption.mjs evidence/posting-history-20261113
node integration/local-console/test-post-batches.mjs evidence/posting-history-20261113/capture.json evidence/posting-history-20261113/selection.json
node integration/local-console/test-owner-post.mjs evidence/owner-post-block-20261113/owner-post-evidence.json
```

All six suites exited0. The new integration suite records15 checks over real loopback HTTP: accepted new-owner post; invalid/missing recipient and final registry proofs; altered receipt; RPC error; endpoint reorg; cancellation and truncated responses at both new acquisition points; retries; nonce discontinuity; UI rendering and clearing after rejection. The pre-existing reader, console, interruption, batch and ownership regression suites pass unchanged. The old mixed-block rejection control still correctly rejects an unenriched history lacking the required transition proofs.

An initial runner supplied a directory instead of two JSON files to the existing-history test and failed before verification with EISDIR. That invocation and its logs remain preserved locally. The corrected commands above produced the published exits. The UI checks use a minimal DOM, not a browser-wallet interaction.

## Limits and next gate

The test RPC serves preserved valid local evidence and deliberately malformed responses, with a selected synthetic genesis marker. It is not a newly mined run, public-chain authentication, consensus/finality verification, or reproduction by an independent operator. Selected fixture code hashes, account2, controller and endpoints remain trusted configuration. No real assets or mainnet readiness is implied.

Next: run the integrated acquisition against a fresh isolated local execution, then obtain independent reproduction of the exact pinned setup. Additional account/contract-wallet designs and full protocol economics remain separate gates.
