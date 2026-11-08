# C-007 commitment boundary review

Public parent: `8073c721545f3b8f661c12a3134117a74636b1e3`

Status: C-007 OPEN. C-001 BLOCKED.

## FACTS

The current contract commits stakes of NFT IDs 1, 2 and 3.
Its allocation excludes the payer NFT account ID.

The original EIP-712 digest remains unchanged when NFT2
transfers A to B with the same stakes and request:

`0xf1f18d46be5eb89acd461ce5ba31b12222a1a671fdfbc78b56e4c963af0fd07e`

A hypothetical combined stake-and-owner commitment produces:

- Signing owner A: `0x328d3838ec727ad23a239303fdcec780c55162a0eece2a9bd3ef3e26adf1a69c`
- Execution owner B: `0xceefa453826cf45e60d4e6a9a9264383486996b8077dd171da90100ec26026de`

The candidate digests differ. Both underlying allocation
models preserve exact integer fee conservation.

The unmodified Solidity distributionHash() guard does not
accept either hypothetical combined hash.

No EVM execution or signature verification was performed.

## INFERENCE

The original signature structure does not commit recipient
ownership. The candidate structure detects the fixed
ownership change.

Binding the complete owner vector could invalidate an
otherwise pending post after an unrelated recipient NFT
transfer. This is a possible liveness and churn concern,
not a demonstrated live attack.

## IDEA

Resolve these specification boundaries before implementation:

1. Account-ID or wallet-owner payer exclusion.
2. Signing-time or execution-time ownership snapshot.
3. Which ownership changes invalidate a pending post.
4. Who may force invalidation, and how retry works.
5. Whether owner commitments can be verified with bounded
   posting and withdrawal work at scale.

No candidate economics or commitment design is adopted.

## STOP CONDITIONS

A passing digest comparison alone does not establish
signature authority, registry state, live token backing,
successful settlement, scalable execution or liveness.

C-007 remains OPEN. Production remains BLOCKED.
