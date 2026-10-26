# Signed local contract-call replay

FACT — one signed legacy call was acquired on owned Anvil1.8.1, London, chain31337. Runtime code `0x60005460010160005500` and storage slot zero=7 were deliberately seeded on a funded test account before the parent block. The code reads slot zero, increments it, writes it back and stops. This is synthetic setup, not a contract-deployment reproduction. No impersonation or public RPC was used.

Parent and child headers, account/storage proofs, runtime code, signed transaction and receipt are retained in the [fixture](../experiments/signed-contract-fixture/fixture.json). The exact raw capture hash is provenance, not chain authentication. Request logs and machine-specific traces are excluded. Acquisition permits fixed local setup and one exact signed call through the existing guarded node wrapper.

Four grouped execution cases passed on the pinned EthereumJS10.1.3 engine:

1. The signed call executes with nonce/balance validation enabled. The body, recovered signature, header and parent witnesses verify. Child account/storage proofs and the captured receipt root verify. Engine output matches captured nonce/balance values for all three accounts, receipt status/logs/bloom/cumulative gas, gas used26012, and slot zero changing7 to8. Runtime code is read from its verified witness, not substituted during replay.
2. An intentional sender-nonce mutation is rejected without changing that modified starting state.
3. An intentional sender-balance mutation is rejected without changing that modified starting state.
4. Removing only the declared storage slot and its proof produces WITNESS_STATE_MISSING_SLOT after four account writes. Adapter health fails; retrying does not resume writes, and discard cannot revive the attempt.

The negative nonce/balance states are deliberately modified overlays, not alternate authenticated proofs. Missing-slot failure is not an ordinary EVM revert receipt. The attempt is rejected. No full post-state root is computed; account proof roots retained by the overlay remain original proof metadata.

After frozen dependency installation, from `experiments/execution-engine` run:

```text
node --max-old-space-size=256 signed-contract-replay.mjs ../..
```

To collect fresh evidence, from the repository root create an empty directory and run:

```text
python -B experiments/signed-contract-fixture/acquire.py --anvil PATH_TO_PINNED_ANVIL --output NEW_DIRECTORY/capture.json
python -B experiments/signed-contract-fixture/project.py NEW_DIRECTORY/capture.json NEW_DIRECTORY/fixture.json
```

Preserve the retained fixture; review a new projected fixture in a separate copy. Local timestamps can differ. Never fund these public test identities with real assets. [Result hashes](../evidence/ENGINE_CONTRACT_RESULTS.json) pin the tested sources. Existing runtime/process/memory/disk guards and dependency versions were unchanged. The four cases are separate from the previously recorded1241-test offline suite, which was not rerun because reference/application modules did not change.

UNRESOLVED — general contract execution, acquired execution-revert/refund behavior, account creation/absence, complete StateManager coverage, full state-root reconstruction, contract-wallet authority, public-chain authentication and production acceptance. Next acquire a signed call that writes storage then reverts; compare captured receipt, unchanged storage and fee/nonce effects. Do not treat this single synthetic program as an audit of CAW contracts.
