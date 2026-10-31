# Gas and payer comparison for paid posts — Issue #7 evidence

> **Status: evidence document for Issue #7** ("Review direct submission,
> relay failure and who pays execution costs"). It is **not** a production
> measurement, **not** a
> relay fault-tolerance verification, and **not** a fee or funding decision.
> It supplies the per-attempt gas and payer figures that Issue #7 asks to be
> published, so that the funding and liveness decisions in C-008 can be made
> from numbers instead of assumptions. All open decisions stay open; see
> §7. No existing code is changed by this document.

## 1. Source records and fixture conditions

All gas figures below are **re-aggregated from the retained local execution
records** in this repository at commit
`60689c13e4d3ccdd8776f8f52b6edde8ed321539` (alpha.46 tree; the paid-action
experiment itself is the alpha.20 baseline):

- Execution trace:
  https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/blob/60689c13e4d3ccdd8776f8f52b6edde8ed321539/experiments/paid-action/execution-trace.json
- Execution summary:
  https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/blob/60689c13e4d3ccdd8776f8f52b6edde8ed321539/experiments/paid-action/execution-summary.json
- Probe contract:
  https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/blob/60689c13e4d3ccdd8776f8f52b6edde8ed321539/experiments/paid-action/CawPaidActionProbe.sol
- Context: `docs/PAID_ACTION.md`, `docs/ECONOMICS.md` (operating cost model),
  `sources/SPEC_CONFLICTS.md` (C-008, C-009), and Issue #7 itself.

Fixture conditions, taken from the trace and `docs/PAID_ACTION.md`:

- Local Anvil (pinned v1.8.1) run, Solidity 0.8.10, optimizer 200, London
  rules; 56 local transactions, 9 posts settled, 22 deliberately invalid
  transactions reverted; runner cap 4,000,000 gas per transaction.
- **Every transaction in the trace uses gas price 100 gwei.** That is a
  fixture constant, not a market price. All ETH figures in §3 are therefore
  fixture arithmetic at the stated gas price, and §3 also shows other gas
  prices for sensitivity only.
- No real wallet was used, no transaction was publicly broadcast, local
  funding used an impersonated public address, and native gas balances were
  fabricated. These numbers **must not** be quoted as mainnet or testnet
  measurements.

## 2. Measured gas: success, duplicate, expired, stale

Post gas is **not a single fixed number**. It varies with calldata length
(text length) and with cold/warm storage state. The table therefore gives
labelled cases, not one "post costs X gas" claim.

| Case (trace label) | Outcome | Calldata (bytes) | Gas used | Error selector | Contract state changed? |
|---|---|---|---|---|---|
| Short post, first submitter (`first_relayer`) | Success | 516 | 171,170 | — | Yes (see §4) |
| Same content, second submitter (`duplicate_other_relayer`) | Revert | 516 | 58,275 | `0x756688fe` (InvalidNonce) | No (before == after) |
| Expired intent (`expired`) | Revert | 484 | 57,945 | `0x392334ed` (InvalidWindow) | No (before == after) |
| Stale-state submission (`stale_pool`) | Revert | 484 | 64,747 | `0x826243be` | No (before == after) |
| Long post, 419 scalars (`unicode_419`) | Success | 1,316 | 573,303 | — | Yes |
| Long post, 420 scalars (`unicode_420`) | Success | 2,148 | 963,188 | — | Yes |
| Short post, composed text (`composed`) | Success | 484 | 102,263 | — | Yes |

Notes:

- The duplicate case is the sequential competing-submitter case: the second
  submitter sent **identical calldata** to the first submitter's settled post
  from a different address, and was rejected because the account nonce had
  already advanced. This is sequential evidence only; it says nothing about
  same-block ordering (see §7).
- A reverted transaction still pays gas. The sender pays
  `gasUsed × gasPrice` even though the execution reverts and no state
  changes. This is standard EVM behaviour and is also stated in
  `docs/PAID_ACTION_REGRESSION.md` ("failed transactions still pay gas").
- The duplicate submitter therefore loses 58,275 gas with nothing to show
  for it, and the expired submitter loses 57,945 gas. The poster loses
  nothing on a revert: no fee is debited and no nonce is consumed.

## 3. Cost formula and gas-price sensitivity (calculated, not measured)

Formula (all prices in this section are scenario inputs, not measurements).
All ETH figures are computed exactly, with no binary floating-point
arithmetic: either as integer wei (`cost_wei = gasUsed × gasPrice_gwei ×
10^9`, then `cost_ETH = cost_wei / 10^18`) or equivalently with Python
`Decimal` at 7 decimal places, as the companion script does:

```
cost_ETH = gasUsed × gasPrice_gwei × 1e-9
```

Worked example: `171,170 × 100 × 1e-9 = 0.017117 ETH`.

| Case | Gas used | 10 gwei | 50 gwei | 100 gwei (fixture) | 200 gwei |
|---|---:|---:|---:|---:|---:|
| Short post, success | 171,170 | 0.0017117 ETH | 0.0085585 ETH | 0.0171170 ETH | 0.0342340 ETH |
| Duplicate, revert | 58,275 | 0.0005828 ETH | 0.0029138 ETH | 0.0058275 ETH | 0.0116550 ETH |
| Expired, revert | 57,945 | 0.0005794 ETH | 0.0028972 ETH | 0.0057945 ETH | 0.0115890 ETH |
| Stale-state, revert | 64,747 | 0.0006475 ETH | 0.0032374 ETH | 0.0064747 ETH | 0.0129494 ETH |
| Long post (420 scalars), success | 963,188 | 0.0096319 ETH | 0.0481594 ETH | 0.0963188 ETH | 0.1926376 ETH |

Reading the table: at the fixture price, a long post costs about 5.6× a
short post, and a losing duplicate costs about one third of a successful
short post. At other gas prices the ratios are the same; only the ETH
amounts scale. No ETH/fiat price is assumed anywhere in this document.

## 4. Who pays, who receives

Two currencies are involved and must not be mixed up: the **post fee is
paid in CAW** (from the poster's credits), while **gas is paid in the
native currency (ETH)** by the transaction sender.

Fee status, stated explicitly: the 5,000 CAW fee is the probe contract's
**experimental value only**. `docs/ECONOMICS.md` states its values are
historical CAW-denominated recommendations, not a final adopted fee
schedule, and `docs/PAID_ACTION.md` calls fee recommendations proposed
profile choices. This document does **not** adopt, recommend, or decide
any fee; it only reports what the experiment charged.

| Role | Pays | Receives from the contract | Notes |
|---|---|---|---|
| Poster (account owner) | 5,000 CAW fee per accepted post, from credits | Nothing for posting | Fee is immutable in the probe contract. The poster's nonce advances by 1 per accepted post. |
| Transaction submitter (any address, incl. a relayer) | All gas for the transaction, win or lose | Nothing | The probe has no paymaster, forwarder, or sponsor payment. "Any relayer can submit. Only exact current-owner authorization can spend; the relayer receives nothing." |
| Relay operator, when sponsoring | Gas for sponsored attempts, plus off-chain costs (below) | Nothing from the contract | Sponsorship is an off-chain arrangement; the contract neither funds nor reimburses it. |
| Relay operator, when only forwarding | Nothing on-chain | Nothing | The user pays gas as the submitter. |
| Other stakers | Nothing for this post | A share of the 5,000 CAW fee, by stake weight | The poster is excluded from its own fee distribution, including while it has a stake. |
| Builder / original operator | Nothing | Nothing | "No builder or relayer receives a protocol share" (`docs/PAID_ACTION.md`). |

Worked fee accounting for the short successful post (`first_relayer`,
from the execution summary):

- Poster credits: `125000000000000000000000` → `120000000000000000000000`
  (a decrease of exactly `5000000000000000000000` base units = 5,000 CAW).
- Other accounts' credits rise by `1666666666666666666676` and
  `3333333333333333333343` (stake ratio 1:2), and `1` base unit remains as
  pool dust. Total credits fall by exactly that `1` dust unit.
- Nonces: `[0, 0, 0]` → `[1, 0, 0]`; message count `0` → `1`.

## 5. Relay sponsorship: cost and risk

If a relay sponsors gas (pays as the transaction sender), its per-attempt
cost is the submitter column of §3, and it additionally bears costs the
contract never sees: monitoring, invalid submissions, retries, bandwidth,
and capital held for gas (`docs/ECONOMICS.md`). None of those off-chain
costs are measured in the retained trace.

Risks, stated as consequences of the measured figures (not as new claims):

- **Griefing asymmetry (scenario arithmetic, not a measurement).** Creating
  an invalid or duplicate signed intent costs the attacker only a
  signature, while a sponsoring relay pays the revert gas. At the fixture
  price, 1,000 duplicate submissions cost `1,000 × 58,275 gas =
  58,275,000 gas = 5.8275 ETH`; at 10 gwei the same 1,000 cost 0.58275 ETH.
  A relay that sponsors indiscriminately can therefore be drained by
  replays of already-settled intents.
- **No reimbursement path.** The probe contract pays the relay nothing and
  has no subsidy balance, so a sponsor's loss on a revert is final unless
  an off-chain arrangement exists. No such arrangement is specified in the
  repository.
- **Mitigation is an open proposal, not a decision.** A sponsor could
  simulate each intent off-chain first (nonce, window, distribution hash,
  signature) and sponsor only intents that simulate cleanly, with a
  per-intent gas cap and a rate limit. This document proposes that shape
  for discussion; it does not adopt it, and the cost of running the
  simulation itself is unmeasured.

## 6. Comparison: relay-sponsored, direct, and subsidy-ended

| Path | Gas payer | Fee payer (5,000 CAW) | What the user needs | Failure modes the user still faces |
|---|---|---|---|---|
| Relay sponsors gas | Relay | Poster | A signed intent and a reachable relay | Relay stops, censors, or is itself griefed (§5); intent may expire while queued |
| Relay forwards only (user submits) | User (as submitter) | Poster | A signed intent, native currency for gas, an RPC endpoint, current nonce/epoch/distribution hash | Stale state → revert gas lost (§2); no endpoint → no submission |
| Direct submission after relay stops | User (as submitter) | Poster | Same as above, plus the user must notice the relay has stopped | Same as above; the contract imposes no barrier to direct submission, but the repository contains no relay server or RPC code, so no end-to-end direct fallback has been demonstrated |
| Subsidy ended (no sponsor, no relay) | User, if they submit directly; nobody, if they do not | Poster, only on acceptance | Same as direct submission | If the user cannot or will not pay gas, the post does not happen. Whether that is acceptable is a specification decision, not a technical one |

Options when a subsidy ends (listed, **none chosen by this document**):

1. Fall back to direct user gas, with the change disclosed to users.
2. A third-party sponsor steps in under its own published policy.
3. No submission path is offered until funding is decided.
4. Any other funding model that is compatible with the source expectation
   — noting that C-008 records growth funds, DAOs, and support tokens as
   rejected by the source, and forbids silently adding a protocol skim or
   a mutable fee.

A subsidy-ended transition also has a timing hazard that is independent
of price: an intent carries a validity window `[validAfter, deadline)`.
An intent queued at a relay when the subsidy ends may expire before the
user re-submits it directly, and a fresh submission then needs a fresh
owner signature with a new window (same nonce). The owner must therefore
be reachable at re-submission time. That liveness assumption is
**undecided**, not proven, by this document.

## 7. What is measured, what is calculated, what is undecided

**Measured (retained local execution, fixture conditions in §1).**
Per-label gas used, gas price (100 gwei, all transactions), outcomes,
error selectors, before/after state for the post cases, and the 5,000 CAW
fee accounting in §4.

**Calculated from the measured figures (no new execution).** Every ETH
figure in §3, the 5.6× and one-third ratios, the 1,000-duplicate scenario
in §5, and the sensitivity table. Recompute them with §8.

This document does not resolve Issue #7 as a whole: it answers the
measured-cost and payer questions and leaves the remaining acceptance
items (race, relay, expiry, subsidy, liveness) open, as listed below.

**Undecided specification (C-008 remains OPEN).** Who funds relay gas and
for how long; what happens, exactly, when a subsidy ends; whether a
sponsor pre-validation policy is adopted; storage, bandwidth, monitoring,
and RPC costs in currency terms; and the bounded liveness assumptions
Issue #7 asks to be recorded (no perpetual-gasless guarantee is made
here).

**Not established by this document.** Same-block competing-submission
ordering (the retained duplicate case is sequential only); resilience to
a censoring or stopped relay end to end; a demonstrated direct-submission
fallback (no relay server or RPC code exists in the repository to test
against); mainnet or testnet gas prices; and any production cost, price,
or affordability claim.

## 8. Reproduction: recompute every number

From a checkout of the repository at the commit in §1, using the
companion script at `scripts/recompute-gas-table.py`:

```sh
git clone https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social.git cawmmunity
cd cawmmunity
git checkout 60689c13e4d3ccdd8776f8f52b6edde8ed321539
git rev-parse HEAD   # expect 60689c13e4d3ccdd8776f8f52b6edde8ed321539
python3 scripts/recompute-gas-table.py .
```

Pinning the checkout to that commit is intentional: it keeps the
reproduction on exactly the records this document cites, even if `main`
moves later. Do not substitute a newer checkout without re-verifying
every figure, because the trace and summary are versioned records.

The script joins `experiments/paid-action/execution-summary.json` with
`experiments/paid-action/execution-trace.json` by label, prints the §2
table and the §3 sensitivity table, and asserts: every listed transaction
uses gas price 100 gwei; the duplicate, expired, and stale cases leave
state unchanged (before == after); and the successful short post debits
exactly 5,000 CAW from the poster with 1 base unit of dust. It exits
non-zero if any assertion fails, so a mismatch cannot silently pass.

Without the script, the same join is:

```sh
python3 - << 'PY'
import json
s = json.load(open('experiments/paid-action/execution-summary.json'))
t = json.load(open('experiments/paid-action/execution-trace.json'))
by = {tx['label']: tx for tx in t['transactions']}
for row in s['transactions']:
    tx = by.get(row['label'])
    if tx:
        print(row['label'], row['status'], tx['receipt']['gasUsed'],
              tx['transaction']['gasPrice'],
              row.get('before') == row.get('after'))
PY
```

## 9. Relation to existing documentation (duplication check)

This document was checked against the repository before drafting:

- `docs/ECONOMICS.md` states the cost framework (monthly expense =
  batches × measured gas × scenario gas price, payers named; relays also
  pay monitoring, invalid submissions, retries, bandwidth, and capital;
  scenarios must include zero sponsorship and unavailable relays) and a
  storage-arithmetic example. It contains **no per-attempt gas table**;
  this document supplies the measured-gas input that framework asks for,
  and does not repeat its storage arithmetic as its own result.
- `docs/PAID_ACTION.md` states the qualitative payer facts quoted in §4
  (no builder/relayer share; local submitters pay gas; funding
  unresolved) and the fixture conditions in §1. It contains **no
  per-attempt gas table**; §2 and §3 are new.
- `docs/PAID_ACTION_REGRESSION.md` states that failed transactions still
  pay gas and that rejected receipts contain no logs. §2 relies on that
  statement and adds the measured revert amounts.
- Issue #7 (no comments at the time of drafting) asks for measured
  successful and rejected costs, the payer for each cost, and behaviour
  after a subsidy ends. §2–§4 answer the first two; §6 lists the third
  as options, not as a decision.
- Open pull requests #11 (docs, Unicode examples), #12 (420-scalar
  counting test), and #13 (post resubmission test) do not touch gas or
  payer questions. There is no overlap with them.
