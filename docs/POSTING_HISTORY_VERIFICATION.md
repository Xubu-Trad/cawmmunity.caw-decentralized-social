# Posting history: strict transaction, receipt and ownership verification

## Result and scope

The existing local console produced two real signed posts on the disposable Geth chain: account 2 through its contract wallet at epoch 1 / nonce 0, then through its new EOA owner at epoch 2 / nonce 1. The new offline reader reconstructs both posts from four consecutive complete blocks (12–15) after the reviewed posting deployment at block 11. It requires final posting nonce 2. All 15 negative controls passed. No verification rule in the existing readers was relaxed.

This authenticates evidence against explicitly selected **local** header endpoints. It does not authenticate a public network, establish consensus/finality, replay EVM execution or demonstrate independent operation. The browser feed remains RPC-backed; this increment supplies the strict offline verification path, not a claim that the UI now enforces it.

## What is checked

- Existing Shanghai header reader recomputes each header hash; consecutive numbers and parent links connect the selected start and end.
- Existing transaction/receipt reader reconstructs complete transaction and receipt commitments. Existing sender reader verifies protected signatures on chain 31337. RPC `from` fields are not accepted as proof of authorship.
- Header-bound state proofs bind registry owner/epoch and posting nonce to each parent state root; selected runtime code hashes are checked for registry, posting contract and the fixture wallet. An EOA owner must have the empty code hash.
- Successful posting events must match the exact canonical event encoding, account, epoch, nonce, proven owner, UTF-8 text and text hash. Signed calldata must match the direct EOA action or fixture-wallet wrapper, with zero native value. The wallet signer must match the explicitly selected reviewed controller.
- Nonces start at zero after the selected deployment anchor and reconcile with the final storage proof, rejecting omitted history. The text decoder preserves the leading U+FEFF in the second post; markup in the first post is data.

## Trust boundaries

The selection supplies reviewed deployment identities, code hashes, wallet controller, registry storage layout and local endpoint hashes. This reader checks those selections against proofs; it does not independently derive the controller from arbitrary wallet code, authenticate the deployment transaction, or certify arbitrary account implementations. The posting/registry bindings rely on the reviewed fixed fixture and code selection. Deployment provenance and public consensus anchoring remain separate work.

Only account 2, the reviewed fixture wallet / EOA paths, and **at most one transaction per block** are supported. Multiple transactions fail closed because a parent-state ownership proof cannot establish ownership after earlier transactions in the same block. General intra-block execution and arbitrary wallets remain unimplemented. This does not assert complete custody accounting or validate every non-posting state transition.

## Reproduce the saved-history check

Use the research checkout containing this document, Node20.20.2 and npm10.8.2. No node or wallet is started by this command.

```sh
npm ci --ignore-scripts --no-audit --no-fund --prefix integration/local-console
node integration/local-console/test-posting-history.mjs evidence/posting-history-20261113/capture.json evidence/posting-history-20261113/selection.json
```

The test rejects modified signed bytes, receipt status/text, missing/reordered blocks, altered state roots, a wrong-height registry proof, falsified owner values, wrong controller/code selection, missing code selection, altered final nonce, wrong endpoint, and unsupported multi-transaction blocks. These are finite controls, not an external audit.

The capture was freshly read from the preserved browser-run database with the pinned Geth executable; no new transactions were submitted and its temporary node was stopped. This is fresh acquisition of existing execution, not fresh source-to-fixture generation or independent reproduction. The existing live user console was not touched.

[Results](../evidence/posting-history-20261113/tests.json) · [Selections](../evidence/posting-history-20261113/selection.json) · [Provenance](../evidence/posting-history-20261113/PROVENANCE.txt) · [Setup](REPRODUCTION_SETUP.md)

Next: bind the strict reader to console acquisition with explicit accepted/rejected state; preserve the distinction from the RPC timeline, then extend independent reproduction and authenticated chain selection.
