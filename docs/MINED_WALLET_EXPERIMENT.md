# mined contract-signature fixture observations

FACT -- nine focused groups pass. the earlier mode experiment only simulated post calls. this follow-up mines two attempts with identical signed post calldata: mode1 rejects, then mode0 accepts. the rejected receipt has status0 and no logs, and observed accounting is unchanged. the restored attempt has status1, emits logs and advances the observed action nonce and messageCount by one.

the new wrapper checks the existing runner's SHA-256 and makes one exact source substitution to add the two submissions. original wallet/probe contracts, source pins, signed writer and node guards remain unchanged. eighteen signed local transactions and271 local requests completed on the owned synthetic Anvil1.8.1 London31337 node. there was no impersonation or upstream request. the node stopped and its listener was released. the wallet is deliberately publicly configurable; it is not a production wallet proposal.

## what the checks establish

the two mined block bodies each contain the recorded single raw transaction and receipt. unchanged readers verify the header, transaction/receipt commitments, recovered outer sender and immediate parent linkage. tests also compare decoded calldata/sender/destination with the retained writer summary. the accounting comparisons are local getter observations, not state proofs.

altered raw bytes, the other attempt's receipt, changed receipt status, an earlier parent and a forged sender summary reject. source hashes and the public fixture digest are in [results](../evidence/MINED_WALLET_RESULTS.json). no full suite rerun is claimed.

raw envelopes come from the signed writer, not an independent collector. the full request record remains private; its digest is preserved in the compact fixture. the fixed inner post and wallet ownership remain the same, but wallet configuration, block metadata and outer transaction nonce change. those context changes are explicit, not a claim of identical EVM inputs.

UNRESOLVED -- a receipt committed by a selected header is not independent proof that the contract executed correctly. there are no wallet pre-call storage witnesses or independent historical EVM replay in this increment. ERC-1271 verification, execution verification and production acceptance remain false. arbitrary wallets, callbacks/dependencies, EIP-7702, endpoint trust/finality, real-token backing and production withdrawal safety remain outside this experiment.

## reproduce

```text
node --max-old-space-size=256 experiments/paid-wallet-state/check-mined.mjs experiments/paid-wallet-state/mined.json
```

fresh local capture requires the existing pinned Windows/Python/Anvil environment, an existing parent directory and new output filenames:

```text
python -B experiments/paid-wallet-state/capture-mined.py --anvil <anvil.exe> --output <raw.json> --expected-input-sha256 9086b230b5b576bd8d02d1a17ca67509a9a1c18eb4ef92a6ddb86998eb7ea93c
python -B experiments/paid-wallet-state/compact-mined.py <raw.json> <mined.json>
node --max-old-space-size=256 experiments/paid-wallet-state/check-mined.mjs <mined.json>
```

the compactor preserves the selected raw-run fields, records the raw digest and refuses an existing output. fresh signing randomness and timestamps can differ. compare the demonstrated relations, not exact fresh hashes. resource and transport safeguards are unchanged.

next acquire the wallet/probe/registry/token dependencies at each exact parent state and replay the single mined transaction with the separately reviewed execution engine. absent witnesses must reject; post-state evidence must not replace pre-call state. do not widen the ordinary-account history reader to accept contract signatures from these observations alone. [Prior mode experiment](WALLET_STATE_EXPERIMENT.md), [wallet authority review](WALLET_AUTHORITY_EVIDENCE_REVIEW.md).


## witness follow-up

[Parent/child proofs and replay](WALLET_WITNESS_REPLAY.md) reproduce rejection but expose a proven-absent-precompile representation blocker on success. The blocking evidence remains explicit.
