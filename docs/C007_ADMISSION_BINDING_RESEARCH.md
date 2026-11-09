# C-007 — Admission record consistency across languages

RESEARCH_NOT_ADOPTED. Parent `71505812d5041cbe9d9ab3ad2af5280aea51c1bf`, draft PR19. Extends the [candidate event codec](C007_CLAIM_EVENT_SCHEMA.md). No contract, parameter, EIP-712 domain or unresolved policy changed.

## What is bound

`bindCandidateAdmission(log, selection)` first decodes the candidate event against a caller-selected emitter. It requires the selected profile, then reconstructs the existing Python research record commitment using the exact tag and field order:

`SHA256(tag || uint256(chain) || address20(contract) || bytes32(profile) || uint256(payer) || uint256(epoch) || uint256(nonce) || uint256(fee) || bytes32(root) || uint256(total))`

Tag: `CAW_C007_CLAIM_RECORD_RESEARCH_V1` followed by one zero byte. Integer fields use32-byte big-endian encoding. The calculated commitment must equal the event's recordId. Selection uses canonical decimal chain strings; out-of-range or noncanonical encodings reject. The returned frozen object is marked `RESEARCH_RECORD_CONSISTENCY_ONLY`.

This is not a signature or proof of consent. Anyone can compute a self-consistent record. The caller-selected chain/emitter/profile are assumptions, not authenticated deployment context. This function does not bind a record to an actual signed action, successful receipt or fee debit.

## Cross-language evidence

Python's existing record digest produced four [vectors](../evidence/admission-binding-20261108/vectors.json): the two prior snapshot fixtures plus maximum-width and zero byte-boundary cases. Ethers6.16.0 encoded the events; the JavaScript implementation independently assembled the byte preimage and matched all four SHA256 results.

Twelve negative cases rejected: changed payer, epoch, nonce, fee, root, total, recordId, chain, emitter or profile; noncanonical chain encoding; chain overflow. This establishes finite encoding consistency, not general security or external review. Zero/max vectors intentionally exercise bytes and are not valid funded actions or supported protocol settings.

An explicit control changes payerStake without changing recordId. That is expected: the research commitment binds the root/total, not a redundant claimed leaf amount. **Never use the event's payerStake as verified input without checking membership under that root.** The existing snapshot-claim reference requires such a payer proof. A decoder or hash match alone cannot supply it.

## Reproduce

With existing ethers6.16.0:

`node --max-old-space-size=256 integration/core-baseline-v1/test-c007-admission-binding.mjs evidence/admission-binding-20261108/vectors.json`

Regenerate the Python vectors in a new output path:

`python3 integration/core-baseline-v1/make-admission-binding-vectors.py /absolute/path/to/new-vectors.json`

The generator imports the adjacent snapshot and tree reference modules. [Saved result](../evidence/admission-binding-20261108/result.json) records test scope. Node20.20.2, existing ethers6.16.0 and Python standard library were used; no new dependencies or wallet operations.

## Remaining acceptance gates

Receipt inclusion/success and event order, chain/deployment authentication, sender/signature authorization, nonce consumption, actual fee debit/backing and stake membership all remain separate. A production adapter must compose those checks rather than treating this output label as a trusted capability. The research SHA256 identifier is not silently substituted for the frozen EIP-712 signed intent. No admitted event exists on-chain for this candidate yet.

NEXT — Specify and test the boundary between receipt-validated observations and candidate admission/claim application. Keep malformed/failed/orphaned observations from affecting balances, and retain all unresolved economic and ownership choices. README updates remain paused; CI remains deferred.
