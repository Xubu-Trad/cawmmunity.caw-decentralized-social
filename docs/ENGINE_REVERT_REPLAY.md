# Signed local execution-revert comparison

FACT — an owned Anvil1.8.1 London node captured a signed legacy call to seeded runtime `0x60005460010160005560006000fd`. This program reads slot zero, increments and stores it, then executes REVERT. Starting storage was deliberately set to7 before the parent block. The signed bytes are the same as the earlier successful-call experiment; the runtime code is the changed experimental variable. Fresh local block timestamps and resulting headers differ. Neither run proves contract deployment or public-chain state.

Four grouped cases passed on the pinned EthereumJS10.1.3 engine:

1. The signed call returns an ordinary execution-revert result with receipt status0. The adapter observes a storage write of8, then the final slot is7. Verified child proofs confirm the captured slot stayed7. All three account nonce/balance values and receipt fields match the captured child evidence. Gas used is26018. Sender nonce increments once and the sender pays exactly gasUsed times the transaction gas price despite the reverted execution. Adapter health remains valid after this ordinary EVM revert.
2. An intentional incorrect sender nonce is rejected before execution.
3. An intentional zero sender balance is rejected before execution.
4. Removing the required slot from both the selection and proof list rejects execution with WITNESS_STATE_MISSING_SLOT after four account writes. This invalidates the attempt; retry and discard cannot restore usability. It is not accepted as an ordinary revert receipt.

The parent input verifies header/body/signature/code/account/storage commitments. Child account/storage proofs and the captured receipt root also verify before comparing execution outputs. The negative nonce/balance cases deliberately mutate the overlay and do not claim alternate proof-authenticated state.

After frozen dependency installation, from `experiments/execution-engine` run:

```text
node --max-old-space-size=256 signed-revert-replay.mjs ../..
```

To acquire fresh evidence from the repository root, use a new empty directory:

```text
python -B experiments/signed-revert-fixture/acquire.py --anvil PATH_TO_PINNED_ANVIL --output NEW_DIRECTORY/capture.json
python -B experiments/signed-revert-fixture/project.py NEW_DIRECTORY/capture.json NEW_DIRECTORY/fixture.json
```

Keep prior fixtures intact. Fresh timestamps need not reproduce fixture bytes. The projected fixture excludes request/runtime logs and retains a raw-capture hash as provenance. No impersonation or public RPC was used. The code, balances and starting slot were synthetic setup on the local node. Never fund these public test identities with real assets.

[Result hashes](../evidence/ENGINE_REVERT_RESULTS.json) identify the tested sources. All four cases passed with unchanged resource guards and dependency versions. The previously recorded1241-test ordinary offline suite was not rerun or inflated because reference/application modules were unchanged.

UNRESOLVED — no full post-state root, general revert/refund coverage, account creation/absence, contract-wallet authority, full StateManager certification, public-chain authentication or production acceptance. This program has no successful clear-storage refund path. Next isolate refund accounting with a signed storage-clearing call, then extend beyond these single-slot synthetic programs.
