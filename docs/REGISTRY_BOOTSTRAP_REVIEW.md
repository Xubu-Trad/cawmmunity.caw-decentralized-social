# registry and bootstrap authority boundary

reviewed baseline: a327680e7f98831af81fec832ef4927b14f13112, 2026-10-27. [source identities](../evidence/REGISTRY_BOOTSTRAP_SOURCES.json) match the pinned Git tree. this is a source review, not a deployment experiment, independent audit or adopted production design.

## source requirements

FACT -- the retained manifesto, lines36-47, describes burning CAW to mint a unique lowercase alphanumeric NFT username, on-chain ownership/registration, and NFT ownership as the wallet key. lines22-28 require public peer review and no privileged deployer keys or upgradeable proxies. the reproduced r2 message calls for no developer backdoors, proxies or multisigs and a peer-reviewed, agreed release. recovery of that text does not establish its author's identity. [manifesto](../sources/primary/manifesto-pinned.md), [r2](../sources/primary/r2-message.txt).

## observed implementation

| id | FACT: exact surface | boundary |
| --- | --- | --- |
| RB-01 | TestAccountRegistry constructor and _initialMint assign IDs1/2 to first, ID3 to second; arguments must be nonzero. | fixture allocation comes from constructor inputs; no username, burn or later issuance exists. |
| RB-02 | TestAccountRegistry _transfer clears approval, changes owner and increments epoch, including self-transfer, before a receiver callback. | token transfer permission is not itself permission to spend account funds. |
| RB-03 | CawPaidActionProbe constructor stores immutable registry address and expected code hash after checking deployed code. | selection is fixed, but the constructor does not establish acceptable initial owners or a production issuance policy. |
| RB-04 | CawPaidActionProbe _ownerAt restricts IDs1..3, checks code hash around authority(), requires nonzero owner and expected epoch. _directOwner compares msg.sender; _recheck compares owner/epoch again. | these are meaningful local checks, not provenance for the registry's initial storage or its dependencies. |
| RB-05 | public/deployment.json has no chain or contract addresses and disables wallet access. | no production registry is selected or connected. |

[registry source](../experiments/paid-action/TestAccountRegistry.sol), [paid probe](../experiments/paid-action/CawPaidActionProbe.sol).

INFERENCE -- a runtime-code identity and an account-state identity answer different questions. this fixture stores constructor allocations in mappings. reviewing its runtime logic does not reveal which constructor arguments were used in a particular deployment. a changed allocation could satisfy the same nonzero-owner and epoch checks. this is a source-derived consequence; no same-bytecode deployment pair was executed in this review. an immutable caller cannot make a selected dependency permissionless merely by pinning it.

## production acceptance record still needed

all rows are OPEN. a future record must give independently retrievable evidence, not a maintainer's assertion.

| gate | required evidence and negative case |
| --- | --- |
| RB-G01 chain and state | explicit network/genesis/fork, accepted anchor and freshness policy; divergent, stale and missing anchors must not silently restore permissions. the competing-anchor experiment remains applicable. |
| RB-G02 deployment | creation transaction/receipt and constructor inputs, deployed runtime/compiler identity and registry-to-paid-contract binding on that chain. reject wrong chain, address, runtime or binding. an address alone is insufficient. |
| RB-G03 initial and current authority | state proofs or independently reproduced state under the selected trust model, authenticating owner/epoch and relevant approvals at the same accepted state. reject substituted initial owners, stale epochs and mismatched state roots. do not infer storage layout from an ABI alone. |
| RB-G04 dependency authority | enumerate every mutable external authority reachable from the selected registry/token/account contracts, including proxies and contract-owner behavior. demonstrate that deployer disappearance cannot freeze issuance or withdrawals. no privileged repair key as a substitute. |
| RB-G05 issuance | unique-name encoding, registration races, exact cost/burn mechanics and token compatibility, with explicit resolution of C-001/C-003. distinguish a protocol burn from an arbitrary inaccessible destination. fixture IDs are not registration. |
| RB-G06 transfer and spending | old/new-owner, approved-operator, self-transfer, receiver callback and contract-wallet cases. an NFT operator must not gain spending rights accidentally; production account-mode support needs its own evidence. DM transfer remains C-005, not solved by ownership proofs. |
| RB-G07 independent recovery | another operator reconstructs ownership and balances without the original API, database, domain, credentials or builder judgment, including interrupted recovery and missing historical data. publish exact evidence limits. |

IDEA -- next bounded experiment: deploy this unchanged test registry twice on an isolated local chain with different constructor owners, compare runtime hashes and authority outputs, then bind separate unchanged paid probes. preserve both constructor records. this can demonstrate RB-03's limitation without selecting a production registry, changing economics or adding developer authority. include wrong-code-hash and stale-epoch rejection controls. it cannot choose canonical state or prove production registration.

UNRESOLVED -- production registry design, chain/finality/bootstrap policy, burn compatibility and exact cost schedule remain unadopted. use existing [specification conflicts](../sources/SPEC_CONFLICTS.md) and [authority review](CURRENT_AUTHORITY_DEPENDENCIES.md); do not create duplicate issues merely to record this review. no test passes added, no runtime behavior changed, no independence gate closed. [independent executor reproduction](INDEPENDENT_EXECUTOR_REVIEW.md) still needs another operator.


## Executed follow-up -- 2026-10-27

The source-derived limitation above now has an [11-group local deployment experiment](REGISTRY_BOOTSTRAP_EXPERIMENT.md). Identical registry runtimes accepted by separately bound probes return different initial owners. Wrong-hash, nonowner and stale-epoch controls reject. No production gate closes; no funded withdrawal or signature claim.


## Selected state follow-up -- 2026-10-27

[13 focused groups](REGISTRY_BOOTSTRAP_STATE.md) check three fresh local proofs, including two same-code registry addresses at the same block. Substitution negatives reject in the unchanged reader. Canonicality, current authority and production acceptance remain false.
