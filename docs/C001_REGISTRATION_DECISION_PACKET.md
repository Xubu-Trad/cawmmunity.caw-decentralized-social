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

### Historical sink candidate for public review

The manifesto specifies a transfer to the zero address when a username is minted. The deployed CAW token rejects that transfer. The proposed alternative pays the recommended amount to `0xdEAD000000000000000042069420694206942069` and issues a transferable ERC-721 in the same transaction. This is a change to C001. A transfer to this address increases its balance and leaves total supply unchanged. Its spelling provides no proof that spending from it is impossible.

The [April 2022 funding transaction](https://etherscan.io/tx/0xb875a9cd6b74facc3d6da59fd350ce69ea07c79b07b598e41bd1cebfdcf4be27) connects the CAW token deployer to the riddle-announcement wallet. The [transfer to the proposed sink](https://etherscan.io/tx/0x0377e91a52b5c4ffdae4c4bd6d1fcf9e928bd7b5f1ac25b56ae72029ccf32a76) came from that second wallet. These records establish funding and use. They leave common control and endorsement unverified. [Gilgamesh’s profile minter](https://github.com/GilgameshCaw/Caw/blob/97cd13f3a1423f702d411472fdd2b2a2e7bfbd59/solidity/contracts/CawProfileMinter.sol#L390) uses the same destination for usernames. Its separate buy-and-burn contract uses a different address.

**Review workflow.** Compare the literal rule and the existing alternatives above. Review whether a transfer with unchanged supply is acceptable and record the exact recipient, economic effect, objections and community decision before enabling registration. R2 calls for peer review and agreed changes. The candidate has a fixed recipient, an immutable token and no administrator. NFT ownership alone does not implement account custody or authorize posting in this candidate.

**Local portal lookup.** Keep the disposable Geth node running after the test below. Serve the portal on localhost, open website.html, enter a username and paste the registry address printed by the test. Select chain 1337 in the browser wallet and choose Check local availability. The answer is scoped to that registry and block. A newer candidate deployment is required for the lookup method.

**Reproduction.** With the existing local-console dependencies installed, run `npm ci --prefix integration/local-console/registration`. Start a fresh disposable Geth dev chain as in the local-console workflow. From the repository root run `node integration/local-console/registration/test-registration.mjs http://127.0.0.1:PORT` with its actual port. The test deploys a fixture token and registration candidate, checks the payment and unchanged supply, transfers the NFT and checks duplicate names remain unavailable.


### Local wallet registration

With the disposable fixture node still running, start the loopback wallet portal from the repository root:

```
node integration/local-console/registration/wallet-server.mjs http://127.0.0.1:34898 REGISTRY_ADDRESS
```

Use the candidate address printed by the registration test on that node. Open http://127.0.0.1:34736/ or choose Register with local wallet in the local green portal. Connect a disposable browser wallet, get fixture gas and tokens, review the available name, approve its quoted price and register. Both transactions are signed by the selected browser wallet. The local faucet uses the disposable Geth account to distribute fixture assets. Keep the services bound to loopback.

After mining, the portal checks the transaction input and sender, the registry's ERC-721 mint event, and the name and owner at the canonical receipt block. Reload and use Recheck mined registration to read the last locally saved registration again. These are checks against the selected local node. Public registration and the community burn decision remain pending.
