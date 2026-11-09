# C-001 — Registration and asset compatibility decision packet

Baseline: `2067e032dc14b771667c4654baf3beedc75f9676`, draft PR19. Related gates: C-003 pricing, C-013 username admission, C-012 authority. See [source conflicts](../sources/SPEC_CONFLICTS.md#c-001) and [frozen specification](PROTOCOL_SPEC_V1.md).

## Source requirement

M-008, `37399aeb55974d4b09d404014865b5ef8918e9de`, README.md:L36:

> i. Burn CAW through a contract to mint an NFT. This burned caw will go to 0x0. The NFT will be your username.

FACT — The frozen candidate accepts a constructor token address and uses a synthetic unrestricted token in the recorded lifecycle. It has no public NFT registration. A successful mock deposit or replay does not prove original-token registration compatibility.

FACT — The retained [asset review](RETAINED_CAW_ASSET_REVIEW.md) and [account-proof acquisition record](CAW_ACCOUNT_PROOF_ACQUISITION.md) distinguish historical runtime evidence from missing proof tied to an authenticated state root. The recorded acquisition attempt returned no usable proof; that is an evidence gap, not a new finding that the token is unsafe. This packet did not retry providers or independently reproduce the historical token experiment.

## Alternatives requiring a decision

| Alternative | Required evidence / consequence |
| --- | --- |
| Literal original-token transfer to zero | Prove asset identity, units and exact transfer behavior at a selected authenticated state; reproduce success or rejection. If it rejects, this route is not implemented merely by writing a caller. |
| Different inaccessible destination | Explicit source deviation. A destination balance is not automatically a total-supply reduction; no builder-controlled destination or redirection. |
| Native supply-reducing burn | Requires an actual supported token mechanism and a review of its relation to the literal destination rule. Do not assume such a function exists. |
| Wrapper or replacement asset | Changes asset/custody/redemption assumptions and needs a separate proposal; not a compatibility shortcut or selected plan. |
| Keep registration blocked | Honest current state; permits independent work without falsely claiming a deployable registry. |

## Evidence required before admission code is accepted

1. Pin chain, block hash, token address, header, account proof and runtime; separately establish canonicality/finality assumptions. Verify source/runtime correspondence and decimals from the chosen evidence, without conflating metadata differences with executable equivalence.
2. Reproduce the exact mint-payment path with supply, sender, destination and contract balances before/after. Preserve rejection cases and distinguish transfer-to-destination from supply burn.
3. Record the selected payment mechanism, integer units and complete length/price schedule; close the related C-003/C-013 choices explicitly.
4. Specify atomic NFT admission: payment failure cannot leave a username reserved, NFT minted or funds partially charged; duplicate/racing registrations cannot both succeed. Test malicious token responses and callbacks as separate failure models.
5. Publish the complete authority/dependency graph: no privileged destination change, fee setter or rescue power. Independently reproduce the agreed implementation before release.

NEXT — Obtain the missing authenticated original-asset evidence through the existing reader input contract, or have an independent operator supply it. Meanwhile keep the proposed registration interface separate from assumed burn/pricing choices. No change to the token, registry or fixture constants is authorized by this packet.

## Decision status

UNRESOLVED. This is a review packet, not an adopted rule or deployment authorization. The frozen research baseline remains unchanged. Proposed interpretations require a public rationale, affected interfaces and history rules, negative-case evidence, reviewer objections and an explicit acceptance record. No quorum or privileged approver is invented here. R2 recovery establishes the text, not its author's identity.

R2-004, `8f9da9c32b3aa4ff9f3fb095d9995fd38a8f54a6`, layers/R2-020_hex_transposition/EVIDENCE/reading_rotation.txt:L6:

> 2- that dev and others contribute to it according to the manifesto (or if clear changes were agreed)

R2-005, `8f9da9c32b3aa4ff9f3fb095d9995fd38a8f54a6`, layers/R2-020_hex_transposition/EVIDENCE/reading_rotation.txt:L7:

> 3- eventually we have a thing that is solid, peer reviewed, contributed to by many and it is agreed to be released
