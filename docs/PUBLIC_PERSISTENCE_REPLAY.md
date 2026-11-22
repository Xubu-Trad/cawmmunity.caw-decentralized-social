# Public-input persistence replay

FACT — a fresh directory was populated exclusively from public commit `54f872c70be7173be434e611bff7e8aab10195f0`. Fourteen files covered the fixture manifest and fixture members, the interruption driver and combined runner, the strict reader and its relative JavaScript imports, and the expected registry model. No local source/fixture copies supplied this replay. Fixture members matched their pinned manifest before execution.

The unchanged public combined runner completed: same-identity restart at genesis with zero peers, original source stopped, replacement peer restored 29 exact header hashes/state roots, then 16 storage fields and all five negative controls passed the existing reader. No destination file import or verification relaxation was used. All test services stopped.

This tests availability and completeness of the published input set. It is **same-machine, same-operator replay**, not independent verification. Previously installed Geth/Reth binaries and runtime libraries were reused. A new operator still needs to reproduce that toolchain setup; downloaded source availability does not attest to binary reproducibility or authenticity.

## Reproduce from the fixed public snapshot

Clone the public repository and check out commit `54f872c70be7173be434e611bff7e8aab10195f0` in a fresh checkout. Follow that snapshot's `docs/INDEPENDENT_PEER_REPRODUCTION.md` for the pinned client/runtime setup, then use its `docs/PERSISTENCE_SYNC_REPRODUCTION.md` combined command. This is the exact snapshot replayed here; later report commits do not change its result.

The accompanying inputs.json lists the complete finite source/input set used by this run. Compare SHA-256 and byte size against each checkout file before testing. This inventory is scoped to this experiment, not a general dependency scanner. It excludes executable/runtime dependencies, which must be recorded separately. The fixture manifest is also enforced by the driver. Do not substitute a moving branch or omit the strict reader after successful synchronization.

Choose a fresh output path. Retain start/sync/completion observations, restart results, strict-reader output and provenance, including failed attempts. Never include jwt.hex or credentials in shared evidence. Report client executable hashes, OS/filesystem and strace versions, exact invocation, repository commit, modifications and whether the operator and host are independent. Submit a bounded reproduction report to PR #19; this does not require accepting the broader protocol or deploying funds.

## Downloaded input inventory

| Path | Bytes | SHA-256 |
|---|---:|---|
| integration/peer-sync/fixture/SHA256.json | 358 | `5571f203eb4a4a6f76f59152371bbc76e92104192b2779216214f1f93b653e12` |
| integration/peer-sync/fixture/blocks.rlp.hex.txt | 207969 | `ad675efcb6dca9abc65ea51cdd1716e0fe906b00fee93ddb2dce8244fc8e988a` |
| integration/peer-sync/fixture/capture.json | 54049 | `332fe6093493df66d4aaa21fcfc4f377beef8f4a53155861634fb58ef902f32d` |
| integration/peer-sync/fixture/genesis.json | 544 | `131785d5b4376eb45086c21ee3861f93ed891740ba831ccab465ac63990e30cc` |
| integration/peer-sync/fixture/proof-request.json | 1350 | `0ecf14d06bd3510aecabf34f2f0a8cb1f3f91f58fb6876ce1ad00a895f3ce897` |
| integration/peer-sync/reproduce-persistence.py | 2507 | `a57d968746a17df64cca8bf332da9261d711f4d9ca7d57440a03fbb9edbe7c6c` |
| integration/peer-sync/run-header-sync.py | 12311 | `e3d9acaeb6ab56dde281cb88a39454022d990be2eb2530b1af66c5d4705240be` |
| integration/core-baseline-v1/check-geth-header-proof.mjs | 1391 | `5c1376304f97cbabc6e5a1eb60c957b3ed9716b43b4fd034fd0221f7a2e7147e` |
| reference/header-bound-state-proof.mjs | 3918 | `244e2f468d02b362246ae8e8bc659801b233c7257d774a695d40e9c1d2428955` |
| public/bounded-json.mjs | 6122 | `73312692245add67ea140ef1393efe9577d337d917867f9edca02ce82af8b051` |
| reference/ethereum-execution-header.mjs | 9631 | `dd69f58be27f861939432a2a140298fde3be1393e8d9bbd8b6dfb88c69cb34eb` |
| reference/keccak256.mjs | 2961 | `6ed8268eb811eddb3345ebb47e824346c00585d6bed2ec3767e1783d31615edf` |
| reference/ethereum-state-proof.mjs | 12928 | `56c2278447b1eccef6a29dbeb4da7777ad5330fe5bb67655c1ed9f8564af628f` |
| evidence/registry-later-20261109/result.json | 4974 | `de87ecd043b5ceee7089b9e68e01bbca328bf1a3ceeb62c44730ff1078c66120` |

UNRESOLVED — independent operator/host reproduction, fresh toolchain setup, uninstrumented timing, power-loss behavior, public chain authentication/finality and production acceptance. A deliberate pwrite64 delay remains part of the experiment. An observed sync entry does not prove termination inside that syscall. Prior failure evidence remains intact.
