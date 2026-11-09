# C-007 — Snapshot-bound account-credit claims

RESEARCH_NOT_ADOPTED. Parent `353b6615bf2ba3986c303cae7ad6a128c2f8057b`, draft PR19. Extends [stake-prefix allocation](C007_PREFIX_ALLOCATION_RESEARCH.md) as an offline state-machine reference. No frozen contract, parameter or unresolved policy is changed.

## Record and claim binding

IDEA — Preserve each admitted fee's chain, contract, profile, paying account, ownership epoch, nonce, fee, stake root and total. This experiment hashes those nine fields with a separate research SHA256 tag. It is NOT an EIP-712 signing format or a replacement for the existing signed-action domain. Changing any field changes the record ID in the checked fixtures.

Admission records the action key `(chain, contract, profile, payer, epoch, nonce)` once, preventing the fixture API from admitting a different fee/root for the same action. Domain fields must match the fixture's configured domain. This helper accepts synthetic fixtures: it does not verify a signature, debit a payer, acquire a canonical root or prove real backing. It must not become an unrestricted production admission endpoint.

Each claim identifies its fee record and account. Both payer and recipient membership proofs must verify against that record's root/total. A `(record ID, recipient account)` marker prevents repeat credit, including zero-amount claims. The amount is derived from committed fields and proofs; the claimant supplies no arbitrary amount or payout address. A distinct record can credit the same account once again. All validation precedes changes to the fixture's claim markers, remaining budget and account credits.

Proof submission credits the recipient account, never the submitter. It does not authorize a withdrawal or decide whether old rewards follow an NFT transfer. This separates amount verification from the still-open ownership and spending rules.

## Evidence

Run `python3 integration/core-baseline-v1/c007-snapshot-claims.py`. It loads the adjacent prefix-allocation reference using Python's standard library. [Saved result](../evidence/snapshot-claims-20261108/result.json) records:

- Two fee records with different stake roots, fees5 and7. Final credits: account2 gets1, account3 gets11, account4 gets0. Both remaining budgets are0; total credited equals12.
- Six recipient-order permutations, interleaving claims across the two records, yield identical final credits and budgets. This is finite ordering coverage, not every possible history.
- Thirteen rejected operations leave the entire fixture state unchanged: unknown record, replacement fee/root for an admitted action, foreign chain/contract/profile, proofs from the wrong earning snapshot in either direction, wrong payer/recipient weights, payer claim, duplicate claim and duplicate zero claim.
- Nine record-field mutation checks change the research commitment.

After each tested transition, the model checks each fee equals remaining budget plus its claim receipts, and total account credits equals receipt totals. These are accounting identities over synthetic numbers, not token solvency evidence.

## Boundaries and next work

The account-order rounding tradeoff remains unchanged. Both code and tests were authored here; there is no new external review or deployed-EVM result. Python object immutability and methods are not a production security boundary. No token custody, signed admission, transfer/epoch withdrawal rule, malicious external callback, gas bound, authenticated chain history or reorg rollback is supplied.

NEXT — Define replayable admission/claim events and reconstruct this fixture with the existing history-reader boundaries. Test rejection/rollback of orphaned admissions and claims without inventing token backing or deciding NFT beneficiaries. A production candidate must bind admission to the exact authorized fee debit and earning root, keep claim availability independent of a builder, and preserve withdrawal rights under an explicitly reviewed ownership rule. C-007 remains open; README updates remain paused.
