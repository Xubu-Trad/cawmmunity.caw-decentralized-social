# C-007 payer exclusion decision-evidence packet

Status: OPEN — research only.
Public parent: `7d93e0c74cd18308bd3057f4cdf79d82365aa8cd`.
Experiment manifest SHA-256:
`2806cc6c2d1934a6ada9f2ea84fa7642645bf55c51d665a8f38f66451acbdfb3`.

## FACTS — Source and implementation

Manifesto physical line 52 describes proportional payment
to "all other stakers". It does not identify whether
the exclusion unit is an NFT account or wallet address.

The published three-account Solidity probe excludes the
payer account ID (`id != payer`), not all accounts owned by
that wallet.

C-007 in `sources/SPEC_CONFLICTS.md` remains OPEN.

## FACTS — Fixed experimental inputs

Payer NFT 1: wallet A, 10 CAW staked.
NFT 2: wallet A, 1 CAW staked.
NFT 3: wallet B, 2 CAW staked.
Post fee: 5,000 CAW = 5000000000000000000000 base units.

Only the exclusion predicate differs.

| Recipient | Account-ID exclusion | Wallet-owner exclusion |
| --- | ---: | ---: |
| NFT 1 | 0 | 0 |
| NFT 2 | 1666666666666666666666 | 0 |
| NFT 3 | 3333333333333333333333 | 5000000000000000000000 |
| Dust | 1 | 0 |

Both algorithms conserve the entire fee with integer
flooring. The original model also passed an independent
Fraction arithmetic oracle.

## INFERENCE — Consequences

Account-ID exclusion permits a second NFT held by the
payer's wallet to earn a portion of that payer's fee.

Wallet-owner exclusion prevents this particular
same-wallet payment, but not payments to another wallet
controlled by the same person.

Neither policy alone establishes resistance to identity
splitting, economic manipulation or ownership changes.

Account ownership must be bound at an explicit snapshot.
NFT transfers, contract wallets and pending signed actions
can otherwise make wallet-based eligibility ambiguous.

The experiment does not prove scalable gas, safe custody,
stake lifecycle behavior or production acceptance.

## IDEA — Community decision questions

Should "other stakers" exclude the payer NFT, every NFT
currently held by its wallet, or another explicitly defined
identity group?

What is the authoritative ownership snapshot?
What occurs after a transfer but before execution?
How are sybil splitting and self-rewarding disclosed?
Who owns accumulated dust and how is it withdrawn?
What happens when no eligible recipient exists?

No answer is selected by this packet.

## NEXT ACCEPTANCE

1. Record alternative interpretations and objections.
2. Define one provisional, explicitly unapproved rule.
3. Test transfers, stake changes, zero pool and rounding.
4. Implement bounded accounting and authorized withdrawals.
5. Obtain independent reproduction and protocol review.

C-001 original-token username registration remains BLOCKED.
No new Solidity execution or live CAW transaction occurred.
No community decision or deployment is authorized.
