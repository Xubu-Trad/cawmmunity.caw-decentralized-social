# C-007 — Exact-rational reward index research

Status: RESEARCH_NOT_ADOPTED. Parent `1c3d4446284820c3abf6d8cd65a5f49e09173cdb`, draft PR19. This explores one alternative in [the distribution decision packet](C007_DISTRIBUTION_DECISION_PACKET.md). It changes no contract, frozen parameter or unresolved decision.

## Proposed semantics, not source-mandated choices

IDEA — Keep a global accumulated reward per stake unit, with each account's weight, index checkpoint and accrued reward. Exclude the paying account (not every account with the same wallet owner). Use execution-order weights, supplied externally in this experiment. Retain exact fractional entitlement across actions; integer claims leave fractions intact. These are experiment assumptions, not decisions settling C-007 or a replacement for the frozen signed-root profile.

For an input fee F, total weight S and payer weight w, reject if S-w is zero. First settle the payer's past rewards. Increase the index by F/(S-w), then move only the payer's checkpoint to the new index. Other accounts accrue weight times the index difference when next read or settled. Settle accrued rewards before changing an account's weight. New accounts start at the current index, so receive no past fees.

The candidate's post operation touches one account and the global index; it does not enumerate recipients. Weight changes and claims also touch one account. That bounds account visits, NOT arithmetic cost or EVM gas: exact rational numerator/denominator growth remains unbounded. The test verifier enumerates accounts to compare outputs and conservation.

## Reproduction and observed result

Run `python3 integration/core-baseline-v1/c007-reward-index-reference.py` using Python's standard library. Seed7007 fixes the trace; [the result](../evidence/reward-index-20261108/result.json) includes every operation. A separate eager model distributes each fee immediately to every other account, and the comparison checks each account's pending reward after every transition.

FACT — 480 transitions across102 dynamically admitted accounts matched exactly: fees93343, integer claims46946, total remaining entitlement46397. Individual remaining amounts may be fractional; the aggregate is an integer because all input fees and claims are integers. Four rejected operations left candidate state unchanged. Two injected mutations were detected: failing to advance the payer checkpoint, and changing weight before settling prior rewards.

FACT — The largest global-index numerator or denominator reached894bits in this finite trace. Its exact representation therefore does not fit a single uint256. This is an observed limitation of this rational design, not a claim that no bounded representation or alternative algorithm is possible.

## Scope and blockers

- Both models and the harness were authored in this work. Different allocation structures provide a reference comparison, not independent external review.
- Weights and fees are input numbers. There is no token custody, payer debit, signed authorization, authenticated stake proof, NFT ownership transfer or production admission.
- This model retains fractional entitlement across posts. The frozen fixture floors each action and retains poolDust. Those are different economics: do not substitute this model as an optimization that supposedly preserves existing behavior.
- The zero-pool rejection and account-level payer exclusion are provisional. The model does not identify distinct humans or resolve multi-account policy.
- Integer claims in Python are not token transfers. Reentrancy, revert rollback across contracts, malicious tokens and gas limits were not exercised.
- Four finite rejected inputs and480 finite transitions do not prove all sequences or arithmetic bounds. No uint256 implementation, deployment or immutable release is established.

NEXT — Before proposing contract code, choose a reviewed representation and explicit rounding/carry rule, bound precision/overflow/error, and compare it against this exact reference under adversarial operation ordering. Include tiny fees, very large and rapidly changing weights, repeated claims, payer exclusion and near-maximum integers. A fixed-point scale alone is not a proof; it can create unallocated dust and inconsistent entitlement. Keep C-007 open and preserve the current frozen acceptance baseline.
