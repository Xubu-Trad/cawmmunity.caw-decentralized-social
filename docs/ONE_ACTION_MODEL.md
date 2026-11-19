# Executable one-action transition oracle

2026-11-08. Parent: `4bbd69bad5cd6abc51fc5b9efff23336e88a5fc0`.
This implements a **model subset** of the proposed
[account-entitlement profile](ONE_ACTION_PROFILE_PROPOSAL.md), not a settlement
contract. Proposed economic rules remain unaccepted; C-001 and C-007 stay open.

## What changed

The [model](../experiments/paid-action/one_action_model.py) composes synthetic
deposit, stake, post allocation, account transfer, nonce cancellation, unstake
and withdrawal transitions. It retains account credits/stakes/nonces on transfer
and advances the ownership epoch. A current-owner cancellation strictly advances
the nonce. All calls return a detached next state; rejected calls leave the
input unchanged. This functional copying is the model's rollback mechanism,
not evidence about EVM transaction atomicity or callbacks.

The integer payout oracle floors each eligible account's share per post, excludes
the payer account and retains dust. Stake is part of credit, not an additional
liability. The fixture admits no unsolicited surplus; it requires
`vault = sum(credits) + dust`. Wallet-to-vault moves conserve their combined
synthetic asset total. Exact Python multiplication does not prove bounded
Solidity intermediate arithmetic.

Caller and `authorized_owner` strings are trusted fixture inputs. Anyone running
the model can supply them: **this is not an authorization or signature verifier**.
The exact stake tuple is an equality oracle, not an authenticated commitment or
encoding. There is no chain ID/domain checking, token call, registry contract,
wallet-policy execution, public registration or history authentication.

## Executed scope

**FACT:** ten focused unittest methods passed internally on the runtime pinned
in [run.json](../evidence/one-action-model-20261108/run.json). They include multiple
subcases; ten is the method count, not an inflated total of subcase assertions.
The [saved log](../evidence/one-action-model-20261108/tests.log) records the run.
No user's Ubuntu execution is claimed and the full repository suite was not run.

| Proposed acceptance case | What this model actually exercises | Still missing |
| --- | --- | --- |
| A01 | Synthetic deposit/stake/post/unstake/withdraw with exact allocations and conservation | Real signing, token execution, compiled contract and separate reader |
| A02–A04 | Recipient transfer preserves intent/allocation; old/new owner withdrawal branches; payer transfer-return rejects old epoch | Actual signatures, registry/withdrawal receipts and independently acquired state |
| A05–A06 | Same intent object works after stake restoration; cancellation prevents revival; stale/unauthorized/non-increasing cancellation rejection | Signed calldata, wallet authority and EVM ordering |
| A07, A09 | Repeated nonce rejection and both modeled post/cancel orders | Wrong domain/chain/contract/fee/profile signature tests and transaction execution |
| A08, A11 | Zero-pool rejection, existing 1:2 rounding case, locked withdrawal, UTF-8/scalar boundaries | Exhaustive arithmetic boundaries and signer/contract/reader agreement |
| A12 | Arbitrary registered ID values with 4, 17 and 65 supplied accounts | Registration, numeric cost budget or scalable algorithm; all operations copy state and posts enumerate recipients |
| A13 | Injected maximum nonce rejects further posting/cancellation advance while unlocked withdrawal works | Long-lived reward index/precision continuation and absent participants |
| A10, A14 | Not exercised | Callbacks, contract wallets, independent operation and public reconstruction |

**FACT:** two isolated negative controls remove one guard each. Removing epoch
equality fails the transfer-return assertion; removing post nonce equality fails
the post/cancel-order assertion. Each mutant exits 1 at behavioral assertions,
not import/setup errors. [Control identities and results](../evidence/one-action-model-20261108/negative-controls-v2/controls.json)
retain exact replacements and log hashes. Public log derivatives replace only
the absolute control-directory prefix in traceback filenames with
`<CONTROL_DIRECTORY>/`; raw logs and the first pre-publication control run remain
locally retained. These failures were expected, not two additional passing
protocol tests.

**INFERENCE:** the proposed cancellation and epoch rules distinguish permanent
invalidation from temporary stake mismatch within this model. They do not prove
authentication, integration safety or public liveness. In particular, this model
does not make the previously identified scaling/rounding decision disappear.

## Reproduce

Python standard library; retain assertions and use a fresh output directory for
the mutation controls. The helper uses Linux resource limits and leaves both
mutated sources, copied tests and failure logs in that directory.

```sh
python3 -I -B tests/test_one_action_model.py
python3 -I -B tests/check_one_action_mutations.py /tmp/caw-one-action-controls-UNUSED
```

Replace `UNUSED` with an unused lane name. Existing output directories are
rejected, never overwritten. Direct unittest execution has no outer resource
supervisor; the recorded internal run used 512 MiB address-space, 15 CPU seconds
and 30 seconds wall timeout after disk/memory admission checks. Each mutation
child applies those same process limits. No runtime installation or CI ran.
Durations in unittest output vary, so new log hashes need not match the retained
run. Compare source identities and assertions separately from runtime output.

## Next implementation boundary

Use this oracle to compare a replacement contract's state transitions once its
accounting and commitment design is specified. Do not deploy this Python model,
use trusted owner labels as authentication, or translate its population loops
and call the result scalable. The existing fixed-point and rational models
already demonstrate alternative rounding; this increment does not repeat those
experiments or select one. Exact signed-domain and bounded accounting algorithms,
wallet/token adversarial execution, independent readers and the public-action
milestone remain outstanding. Hosted CI is deferred.

Original code and explanatory text use the repository's MIT license. The
artifact [provenance inventory](../evidence/one-action-model-20261108/provenance.json)
records parents, transforms, hashes and sizes; public run records contain no
private handoff data or local absolute paths.
