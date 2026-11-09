# Funded credits: ownership and withdrawal integration plan

Status: PROPOSED_RESEARCH_INTEGRATION, not an adopted specification. Reviewed parent `bf2e09815bddc960b1dcfa1ffd3dc538d884a4ae`. This connects the existing custody/owner-epoch implementation to the new funded claim ledger without replacing the frozen baseline.

## Source-backed authority and remaining choices

FACT — [M-011 and M-013/M-014](../sources/MANIFESTO_REQUIREMENTS.tsv) record manifesto passages at `cawdevelopment/manifesto` commit `37399aeb55974d4b09d404014865b5ef8918e9de`, README lines40–47. The passages give the NFT owner account/balance access and make NFT ownership the key for deposits and withdrawals. Holding, rather than staking, provides that access. An approved transfer operator is not automatically entitled to withdraw for the current owner.

FACT — [signed withdrawal evidence](SIGNED_WITHDRAWAL_ACQUISITION.md) already covers approval-only/operator-only withdrawal rejection before ownership changes. Do not redo that experiment as if new. [The earlier ownership commitment review](C007_OWNERSHIP_COMMITMENT_BOUNDARY_20261107.md) records that fixed account stakes do not commit recipient owners, and that binding every recipient owner can introduce pending-action invalidation. Its evidence was a digest comparison, not contract execution.

UNRESOLVED — C-007 still needs reward snapshot/exclusion/rounding and pending-action semantics. C-005 includes transfer and DM consequences; C-009 covers spending scope, replay and session revocation; C-013 covers the final account lifecycle. Ordinary current-owner access to an existing account balance is supported by the manifesto. Whether a not-yet-claimed historical reward belongs to that account after a sale needs an explicit disclosed choice; do not treat unresolved DM design as permission to ignore current-owner spending authority.

## Observed implementation boundaries

The frozen compiler input contains `custodyAuthority`, `withdraw` and `transferAccount`. Direct calls require current owner and expected epoch. Withdrawal subtracts available credit/liability before the external token transfer, checks exact vault and recipient deltas, and uses the shared guard. Account transfer changes owner and increments epoch while preserving credit and stake. These are three-account research slots, not proof of an integrated ERC-721 registry.

The new funded claims keep account credits plus unclaimed record budgets. Their `unclaimedLiability` variable actually remains total unpaid liability, including credited amounts. Claims shift a budget to credit without moving tokens. A direct copy of the frozen `liabilities == credit1 + credit2 + credit3` check would omit outstanding budgets. Rename the new integrated fixture's total to `unpaidLiability` and distinguish `unallocatedBudget` from `creditedLiability`; never count the same reward twice.

## Proposed next bounded fixture

Reuse the direct current-owner/expected-epoch pattern with a constructor-defined account-owner map and no setter for a developer. Only the current owner may transfer its own fixture account; every transfer increments the epoch. Label this a controllable fixture standing in for the future NFT registry, not a real NFT implementation. Keep claims permissionless but always credit the proven account, never the submitter.

For this proposed experiment only, credits and historical unclaimed records follow the account across transfer. This is an explicit account-bound hypothesis, not C-007 acceptance. A competing signing-owner entitlement would require separately committed beneficiary data and a documented exception to account-balance continuity; it must not be implemented through an off-chain operator's judgment.

Direct withdrawal pays the current caller only, with explicit account, expected epoch and positive amount. It cannot touch another account, unclaimed budget or staked principal. Do not introduce an arbitrary recipient, relay signature, new session permission, expiry rule or emergency admin in this increment. The transaction signature authenticates the direct caller; it is not a new EIP-712 withdrawal design. Future delegated withdrawal requires its own domain/recipient/nonce/epoch decision and tests.

All mutable admission, claim, account-transfer and withdrawal entry points must share one callback guard in the combined fixture. This matters even for claim, which makes no token call itself: a token callback during withdrawal must not reenter it or move account ownership between checks. Reuse exact vault decrease and recipient increase checks. A false-returning/reverting/inexact token must revert the full operation, including credit/liability changes. Test this behavior, do not infer it from the old contract's checks.

## Accounting obligations

At every step: `unpaidLiability = unallocatedBudget + creditedLiability`, and `creditedLiability = sum(account credits)`. Token vault balance must cover unpaid liability. Surplus tokens are not automatically someone else's credit and confer no developer withdrawal right.

Admission increases vault, unpaid liability and a record budget by the exact received fee. Claim decreases that budget and increases the proved account credit by the same amount; total liability and vault do not move. Withdrawal decreases only the caller's available credit, credited liability, unpaid liability and actual vault balance by the same amount. Transfer changes owner/epoch only. A failed operation changes none of these accounting or authority values; gas and outer transaction nonce still change.

The current experiment has no staked account principal. If deposit/staking is later joined, define separate available and locked balances and incorporate them into the conservation equation before reusing this rule. Snapshot weight is not itself withdrawable token custody.

## Concrete acceptance sequence for the next implementation

Start with two fee5 records, vault10 and budgets10. Claim account2's first reward1, transfer account2 A to B, then claim its second reward1. Under the disclosed account-bound hypothesis B controls credit2. Reject A's withdrawal, B's stale epoch, any non-owner's call, and excess amount3; successful B withdrawal2 leaves vault8 and unpaid liability8. The remaining account3 claims total8, with zero-value account4 claims marked once, and only its current owner can withdraw8. End with vault0, credits0, budgets0 and liability0.

Also test transfer A to B to A with monotonically increasing epoch (old epoch never revives), unrelated account isolation, zero amount, duplicate withdrawal after credit exhaustion, token false-after-mutation/revert/inexact deltas, and callbacks into every mutable entry point. Event reconstruction must derive the same ownership, epoch, budgets, credits, total liability and final token balances. Then run the exact signed sequence in the second engine. Existing successful claim/admission sequences remain regression inputs.

## Review disposition

No new contract or token transfer is implemented by this plan, and no new test pass count is claimed. This is a source review and integration specification. The next engineering increment can implement the bounded account-bound hypothesis with the above limits; an adopted NFT/production withdrawal release still requires explicit decisions, review and authenticated asset evidence. README remains paused; hosted CI remains deferred.
