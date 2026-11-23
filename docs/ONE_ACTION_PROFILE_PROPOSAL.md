# One-action profile proposal: account entitlements

Prepared 2026-11-08 against `832e3eb88ca75694a55da0478c9106046b41ba56`.
Status: **IDEA / PROPOSED, NOT FROZEN OR IMPLEMENTED IN A CONTRACT**. Review identifier:
`draft-account-entitlements-1`. This is a review label, not a deployed or signed
protocol identifier. It extends [candidate terms](CANDIDATE_TERMS_REVIEW.md) and
work package 2 of the [public-action milestone](PUBLIC_ACTION_MILESTONE.md).

This proposal makes specific choices reviewable. Publication does not accept
them. C-001, C-007 and the other source conflicts remain open. No contract,
signed format, registration rule or public deployment changes here. A synthetic
rehearsal cannot close original-asset registration.

## Evidence and interpretation

**FACT:** the pinned [three-account probe](../experiments/paid-action/CawPaidActionProbe.sol)
excludes payer account ID, commits to three stake amounts, credits accounts and
authorizes withdrawals using current owner and ownership epoch. It has no
explicit cancellation operation or open-population settlement design.

**FACT (attributed):** [R-03](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/issues/5#issuecomment-6717782194)
reports independent hash/arithmetic checks and script execution, with partial
generated-artifact byte identity and no new EVM or signature verification. Its
restored-owner-vector example distinguishes current-state commitment from
permanent revocation. Full execution output has not been independently audited
here. [R-02](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/issues/5#issuecomment-6717222888)
previously reported new-owner withdrawal; [PR #17](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/pull/17)
retains the later paired synthetic post/100-token withdrawal evidence. Neither
report establishes adopted economic rights.

**INFERENCE:** reward eligibility, control of account credit and invalidation of
unexecuted signatures are separate decisions. Adding recipient owners to a
stake commitment would not itself change eligibility or permanently cancel an
intent. It would make unrelated recipient transfers affect pending posts.

## Proposed terms and objections

Every row is a proposal for this named candidate, not a source resolution.

| Term | Proposed rule | Alternative / objection requiring review |
| --- | --- | --- |
| Recipient unit | Registered account ID; exclude only payer ID | Same-owner exclusion changes allocation but does not establish person identity. Account exclusion lets another account of the payer's owner receive rewards. |
| Credit entitlement | Credit and locked stake stay with the account across NFT transfer; current owner controls unlocked withdrawal | Snapshot-owner rights require a separate wallet entitlement ledger. Buyers must distinguish locked stake from liquid credit. |
| Allocation time | Stakes at atomic execution; signed exact stake-state commitment must match | Quoted snapshots need separate settlement rules. Current-state commitments expose posting to stake churn; acceptable liveness is unproved. |
| Recipient transfer | Does not change stake commitment, eligibility or credited balances | Owner-bound commitments detect it but couple posts to unrelated transfers. No recipient-owner vector is proposed here. |
| Payer authority | Current owner and monotonic ownership epoch, rechecked after external calls | Transfer-away/return must not restore old authority. Code hashes alone do not prove this or authenticate initialization. |
| Cancellation | Add direct current-owner cancellation that strictly advances the account's next nonce, with expected ownership epoch | New proposed behavior; temporary stake mismatch and wallet policy changes are separate mechanisms. |
| Fee and text | Retain experimental 5,000 × 10^18 fee and exact strict UTF-8, 1–420 scalars / at most 1,680 bytes, for comparison | C-003/C-004 remain open; denomination and character interpretation are not accepted. |
| Zero pool | Reject atomically; no fee or nonce consumed | Burning or redirecting the fee is a separate choice. Submitter transaction gas can still be spent. |
| Rounding | Reference rule: floor each eligible account's share per post; retain exact remainder separately | Accumulator fractions may produce different lifetime payouts; they are not an interchangeable optimization of per-post floors. |
| Dust | No beneficiary or withdrawal path in this proposed rehearsal; separately counted and backed | Permanently immobilized dust is a material objection. A long-lived candidate needs an explicitly accepted disposition. |
| Submission | Any submitter can present the exact authorized action; no protocol relay reward | This does not establish sustainable gasless use. Failure cost and replacement submission remain issue #7 gates. |

Source interpretations remain in [C-007](../sources/SPEC_CONFLICTS.md#c-007),
C-005, C-008 and C-009. Account-balance access in the source does not completely
specify queued reward rights. No privileged root setter, owner override, fee
setter or reset key is introduced to settle an unresolved choice.

## State and conservation oracle

This is a mathematical reference, not a proposed on-chain population loop.
All amounts are integer asset base units. Let `C[i]` be settled account credit,
`S[i]` locked stake, `N[i]` next nonce, `O[i]` current owner and `E[i]` its epoch.
Require `0 <= S[i] <= C[i]`. Let `D` be dust, `V` vault balance and `U` separately
reconciled unallocated surplus, such as unsolicited transfers. Require:

`V = sum(C[i]) + D + U`, with `U >= 0`.

Stake is already inside credit. Surplus must not silently become builder income
or rewards. Deferred rewards require explicit pending liabilities in this
equation; renaming those liabilities as surplus is invalid.

For payer `p`, fee `F` and `T = sum(S[i], i != p)`:

- Require `T > 0` and `C[p] - S[p] >= F`.
- Set `a[i] = floor(F * S[i] / T)` for each `i != p`; `a[p] = 0`.
- Set `d = F - sum(a[i])`; debit `C[p]` by F, credit recipients by `a[i]`, add d to D.
- V, U and stakes stay unchanged; total credit decreases by exactly d.
- Advance payer nonce and message counter exactly once. Emit exact signed text
  and sufficient transition evidence for an independently authored reader.

Example: stakes `[10, 1, 2]` whole tokens, payer 1, owners `[A, A, B]`, and
`F = 5000 * 10^18` yield `1666666666666666666666` for account 2,
`3333333333333333333333` for account 3 and dust `1`. Transferring account 2 from
A to B leaves those amounts unchanged. Same-owner exclusion would allocate all
F to account 3 before transfer. These are existing reference expectations, not
new execution results.

## Atomic transitions and authorization

| Transition | Preconditions and effect | Required rejection boundary |
| --- | --- | --- |
| Deposit | Direct current owner, expected epoch, positive amount, exact owner-to-vault delta; add amount to credit | Failed transfer, unsupported token delta or callback changing authority rolls back the entire transaction |
| Stake / unstake | Direct owner and epoch; lock available credit or unlock existing stake; settle any deferred entitlement before weight changes | Insufficient credit/stake, overflow, stale epoch; no retroactive reward reassignment |
| Account transfer | Registry changes owner and strictly advances epoch; credit, stake and nonce persist | Returning to an earlier owner cannot restore an earlier epoch |
| Post | Exact domain/message, current owner policy, epoch, nonce, time window, text, fee, profile and commitment; apply oracle atomically | Any failed guard leaves application/accounting state unchanged; transaction gas remains separate |
| Cancel | Direct current owner, expected epoch, `newNonce > N[i]`; set N and emit old/new nonce and epoch | Unauthorized caller, stale epoch, equal/lower nonce or integer wrap |
| Withdraw | Direct owner and epoch; positive amount within unlocked settled credit; debit credit and transfer exactly to that owner | Old owner, locked/excess amount, reentrancy, authority change or token delta mismatch; full rollback |

The proposed validity interval remains `[validAfter, deadline)` with
`validAfter < deadline`; a relay cannot extend the signed deadline. A maximum
duration would be a separate choice. Competing post/cancel transactions follow
canonical execution order: post first can spend before cancellation; cancel
first rejects the old nonce. Cancellation cannot undo a prior post or invalidate
arbitrarily high future nonces beyond the chosen bound.

An otherwise valid intent can revive after stake values are restored if nonce,
epoch, deadline and wallet policy still permit it. Cancellation or payer transfer
prevents revival for the affected nonce or epoch. Contract-wallet policy is
evaluated at execution; a delegation change is not itself protocol cancellation.

The replacement signed schema must bind chain ID, settlement contract, account,
epoch, nonce, interval, text hash, fee, immutable profile and precisely specified
stake-state commitment. Publish exact encoding, domain, vectors and dependency
identities before signing. The old three-stake `distributionHash()` is not an
open-population encoding. A replacement needs a distinct signed profile; old
signatures must not migrate implicitly.

A subsequent [stake-commitment research kernel](STAKE_COMMITMENT_RESEARCH.md)
tests a fixed-depth account/stake tree with bounded logical path updates. It is
not integrated into the model's intent, an accepted signed encoding or a
settlement algorithm; registration churn, root authentication and EVM costs
remain explicit review gates.

## Acceptance cases — not executed by this proposal

Each negative run changes one cause and retains before/after state. Comparisons
use the same pinned candidate/configuration and separate transaction gas from
application-state rollback.

| ID | Controlled case | Required observation |
| --- | --- | --- |
| A01 | Deposit, stake, sign, post, unstake, withdraw on one candidate | Exact token deltas, oracle allocation, one nonce use and conservation throughout |
| A02 | Change only recipient owner between signing and posting | Identical signed calldata remains admissible with unchanged allocation; current recipient owner controls credit |
| A03 | Old/new recipient owner withdraw same unlocked amount in separate equal starting states | Old-owner failure, new-owner success and complete before/after snapshots for both branches |
| A04 | Payer transfer away and back before old signature | Old epoch rejected despite restored owner; balances unchanged |
| A05 | Change and restore stakes without cancellation | Mismatch rejects; actually resubmit identical signature within valid window to test revival |
| A06 | Cancel then restore stakes | Old nonce stays invalid; unauthorized, stale-epoch and non-increasing cancellations reject separately |
| A07 | Duplicate, wrong chain/contract, wrong fee/profile, altered text | Separate single-field cases reject; accepted post debits once |
| A08 | Zero pool, one-base-unit pool, rounding boundaries | Zero-pool rollback; exact allocation/dust and checked arithmetic for other cases |
| A09 | Post/cancel in both transaction orders | Canonical order determines outcome; no retroactive cancellation claim |
| A10 | Token callback or wallet/registry policy boundary | Reentrancy/authority-change rejection; bounded wallet validation; unsupported modes explicit |
| A11 | 419/420/421 scalars and malformed UTF-8 | Signer, contract and reader agree on exact bytes; no normalization |
| A12 | Growing account population, fixed action size | Measured post, claim, stake, transfer and withdrawal costs meet predeclared bounds; no hidden population work or trusted operator |
| A13 | Counter/precision boundary and absent participant | Rejection or proven continuation preserves entitlements; no admin reset or required cooperation of all inactive accounts |
| A14 | Builder and preferred relay absent; fresh independent reader | Public artifacts suffice to operate/reconstruct; local success still does not authenticate public history |

## Concrete implementation gate

A replacement must support an open account population, not rename the three-ID
loop. Before its implementation is frozen, publish:

1. A disposition for each proposed term, preserving objections and deviations.
   Attribute reviewer statements; silence is not assent.
2. Exact accounting and commitment algorithms, integer ranges, complexity and
   numeric gas/size budgets. Account exclusion, per-post floors and transferable
   entitlements must survive the transformation. Changed accumulator payouts
   require a revised policy choice, not an optimization claim.
3. Precision and lifetime-capacity analysis, including tiny pools, zero index
   increments, dust, fractions and permissionless continuation. Existing
   [budget](STAKING_BUDGET_REVIEW.md) and [checkpoint](STAKING_CHECKPOINT_REVIEW.md)
   research do not supply a live solution. Posting limits must be explicit;
   a halt that locks otherwise valid withdrawals is unacceptable.
4. Reproducible local asset/registry configuration with a distinct synthetic
   identity, authority graph and complete transition evidence. Public chain,
   real asset, funding and registration remain separate decisions.

First implementation deliverable: a separately named local settlement candidate
and independent accounting reader exercising A01–A13 on one pinned build. Retain
failures and compare payouts to this oracle. A14 then tests builder absence;
public acquisition and authenticated history still require later milestone
evidence. Hosted CI remains deferred. No case above is claimed to have passed.

The initial document added no test passes. A subsequent [executable transition
oracle](ONE_ACTION_MODEL.md) now exercises a limited model subset of these cases;
it does not satisfy their contract, signature or independent-reader requirements.
No EVM transactions, accepted economics or release claim follow. The next review
question is which proposed term or scaling requirement must change before a
contract candidate can implement it faithfully.
