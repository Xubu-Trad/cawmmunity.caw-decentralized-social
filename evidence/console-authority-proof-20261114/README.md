# Proof-bound current authority for console plans

## Implementation

Previously the console checked selected runtime hashes but used ordinary eth_call responses for the current account owner, ownership epoch and posting nonce. The new verify-console-authority.mjs reuses the existing header-bound state-proof reader to verify the account2 owner/epoch storage slots, posting nonce slot and current owner's code hash under the selected header. snapshot() requires those proofs to match the observed values and rechecks the header by height before returning. Consequently posting, transfer and withdrawal plan generation stops when current authority contradicts the verified state.

This strengthens action planning, not only historical display. A snapshot now includes authorityProofsVerified and authorityHeaderHash. The selected fixture wallet or an empty-code EOA remains the supported owner. Unsupported contract owners fail closed. No new admin or upgrade power is added.

## Fresh execution and regression

Source baseline: bc3035661faa608da5b0149b7cde209aa096aacb. The updated console was exercised on an isolated fresh Geth chain. Before and after the safe ownership transfer, snapshot returned proof-bound authority. The next post plan selected the new EOA, epoch2 and nonce1. The actual transfer and first post history still verified through console HTTP. Second-engine replay matched13 signed transactions and13 post-genesis state roots.

Twelve direct verifier checks passed, including contradictory owner/epoch/nonce observations, altered header root, missing/corrupted proofs and wrong selected runtime hashes. Existing ownership HTTP acquisition15 and interruption11 checks passed. Browser-side post, transfer and withdrawal plan regression suites also passed; these tests are not a real browser-extension run. Original selected controller/code assumptions remain explicit.

## Reproduce

From a checkout containing the update, install the local-console committed lock under Node20.20.2 and run:

```sh
node integration/local-console/test-console-authority.mjs evidence/console-authority-proof-20261114/authority-evidence.json
```

Expected12checks. To repeat fresh mining, use the established Linux/Geth setup, place the checkout in src/ beside mine-authority-proof.py and lane.mjs, and supply GETH_BIN. The lane's inherited old-verifier check also requires copying `evidence/console-safe-transfer-20261113/post-authority-sequence-before-safe.mjs` into src/integration/local-console/. Run `GETH_BIN=/absolute/path/to/verified/geth python3 mine-authority-proof.py positive` with a new output directory. The portable path wrapper is not a separate clean-machine run. Use the existing locked second-engine procedure against the new capture/genesis for replay.

## Limits and next step

Authority is proven relative to a selected local header, not public-chain consensus, finality or a fully authenticated provider. This change does not prove the custody credit, liability or token balance observations still obtained through eth_call. It does not eliminate the time between a plan and its on-chain execution; the contract must still enforce authorization, epoch and nonce at execution. No new wallet type, economic policy or real-asset deployment is approved.

The frozen ownership reproduction package remains pinned to e0fa16d and intentionally rejects this changed server as an input mismatch. Independent reviewers should continue that exact package; do not silently move their target. This new authority extension is a separate evidence increment.

Next substantive step: bind custody credit/liability and token balance observations to the same selected state before presenting them as verified accounting. Independent reproduction remains pending; other builds remain paused.
