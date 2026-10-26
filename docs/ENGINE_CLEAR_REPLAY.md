# Signed local storage-clear refund comparison

FACT — an owned Anvil1.8.1 London node captured a signed legacy call to seeded runtime `0x600060005500`. The program clears slot zero, which was deliberately initialized to7 before the parent block. The signed transaction is unchanged from the earlier contract-call experiments; the runtime is the changed experimental variable. Fresh local timestamps and headers differ. This is synthetic setup, not deployment or public-chain evidence.

Four grouped cases passed on pinned EthereumJS10.1.3:

1. The call succeeds and the verified child storage proof reports zero. Execution gas is5006; intrinsic gas21000 plus execution gas minus refund4800 produces the captured receipt gas21206. All three account balances/nonces, receipt status/logs/bloom/cumulative gas, and storage match acquired evidence. Sender nonce increases once and its debit equals21206 times the signed gas price. Runtime code comes from its verified witness.
2. Incorrect sender nonce is rejected.
3. Insufficient sender balance is rejected.
4. Removing the selected slot and its proof rejects the attempt with WITNESS_STATE_MISSING_SLOT after four account writes; retry and discard do not restore usability.

The input verifies signed body, parent header and account/code/storage commitments. Child proofs and the captured receipt root verify before output comparison. Negative nonce/balance tests intentionally mutate the overlay and do not claim alternate authenticated state. The refund counter is an engine observation; independently acquired net gas and balances agree with it. The London refund cap is not binding in this example, so this does not test cap enforcement.

After frozen dependency installation, from `experiments/execution-engine`:

```text
node --max-old-space-size=256 signed-clear-replay.mjs ../..
```

For a fresh acquisition, from the repository root with a new empty directory:

```text
python -B experiments/signed-clear-fixture/acquire.py --anvil PATH_TO_PINNED_ANVIL --output NEW_DIRECTORY/capture.json
python -B experiments/signed-clear-fixture/project.py NEW_DIRECTORY/capture.json NEW_DIRECTORY/fixture.json
```

Keep retained evidence intact. Raw request/runtime logs are excluded from the projected fixture. Its raw-capture hash supplies provenance, not chain authentication. No impersonation or public RPC was used. Never fund the public test identities with real assets.

[Result hashes](../evidence/ENGINE_CLEAR_RESULTS.json) pin tested sources. Existing guards and dependencies remain unchanged. Four scoped cases passed; the unchanged1241-test ordinary offline suite was not rerun or inflated.

UNRESOLVED — binding refund-cap behavior, multiple-slot access, complete state-root reconstruction, general StateManager coverage, account creation/absence, contract-wallet authority, public-chain authentication and production acceptance. Next use a separately acquired call whose refund exceeds the London cap and compare capped gas and account effects; do not infer cap coverage from this uncapped example.
