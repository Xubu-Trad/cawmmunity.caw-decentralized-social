# Third-party failure gates

Scope: PR19's current research candidate and its build/replay tools at the parent commit recorded in the dependency inventory. This is a scoped dependency review, not a repository-wide audit or an assurance of no vulnerabilities. Reuse the broader [operator-independence register](OPERATOR_INDEPENDENCE.md) for full-system continuity.

[Hacken's Team Finance account](https://hacken.io/insights/why-team-finance-was-exploited-for-14-5-million-despite-its-audit/) says its earlier audit did not cover the migration function later exploited. [Beosin's transaction analysis](https://official.beosin.com/resources/beosin%E2%80%99s-analysis-of-team-finance%E2%80%99s-13m-exploit) identifies the migration path. These reports support requiring review of the exact deployed custody and migration paths; an audit badge or locked balance alone is insufficient. This is not a new independent reproduction of that historical incident.

| Dependency | Current evidence and failure consequence | Required next evidence before release |
| --- | --- | --- |
| Token contract | Candidate TOKEN address is immutable; constructor checks code exists. Tested token is a freely mintable mock. Token failures or changed semantics can block deposit/withdrawal; code presence does not prove token safety. | Pin actual address/chain/code, enumerate token authority/proxy paths; test failed/false/reentrant/nonstandard transfers and withdrawal liveness. No real-token compatibility claim. |
| Contract wallet | Bounded static validation with immutable-controller fixture. Lost controller key has no recovery. Other wallets may have upgrades or mutable signers. | Review each supported wallet's authority and revocation model, failure/gas cases and recovery choices. Do not add a developer recovery key. |
| Custody, lockers, migration and bridges | No third-party locker/migration/bridge is integrated in this bounded fixture. This is not an inventory of every future protocol component. | No integration affecting funds without exact-bytecode review, authority graph, adversarial migration tests and explicit acceptance. Third-party outage must not silently change withdrawal authority. |
| Compiler and npm tools |32locked packages; exact direct versions; integrity fields and expected registry checked; no install-script flags in this lockfile. | Clean build, artifact mirroring, source-to-bytecode comparison, current vulnerability review and review of transitive changes. Pins do not prove benign code. |
| Anvil/Geth/EthereumJS | Local tests use pinned tools; two-engine results exist for earlier frozen sequences. Original Anvil root discrepancy remains. | Resolve provenance/root boundary before authentic-chain claims. Keep alternate execution and negative controls; a shared agreement is not consensus proof. |
| RPC and historical data | Synthetic capture and selected-header verification; endpoint authentication/finality not established. | Independent acquisition, unavailable/dishonest-provider tests, public recovery data and an authenticated checkpoint policy. |
| GitHub/npm distribution | GitHub holds code/review; registry serves dependencies. Neither should be a required credential or sole data source for an operating protocol. | Offline clean build from verified mirrors, restore from a second custodian, public content-addressed release artifacts; preserve license/source provenance. |
| Frontend/domain/storage/relay | Broader roadmap gates remain open; current fixture does not prove these services replaceable. | Operator-disappears exercise with alternate client, transport/storage and no original domain/API keys/database. |

Before accepting any new release dependency, record exact version/hash/license, privilege and fund exposure, failure/replacement behavior, reviewed source scope, known findings and their disposition. Any code or configuration change to custody/migration/authority invalidates the relevant previous approval until reviewed. Freeze release selection; do not introduce an emergency administrator to bypass a dependency failure.

## Executable selection check

From `experiments/c007-new-owner-post`, run `python3 check-dependency-lock.py package-lock.json` and `python3 test-dependency-lock.py /absolute/path/to/new-output`. Six controls reject install scripts, missing integrity, a different registry, resolved-version drift, a direct version range and linked packages. This is an offline selection gate; no current CVE database scan or clean install is claimed. Use installs with scripts disabled, and do not execute downloaded code merely because a hash matches.

## Research homage

The model's source comments contain a small CAW acrostic: Carry the record / Ask for proof / Work without a keeper. This is an original homage to reproducibility and shared responsibility, not a recovered riddle message or evidence of authorship. It introduces no executable branch, secret privilege, hidden address or required puzzle. No Solidity source was changed, avoiding even metadata-bytecode drift in the frozen experiments. Future homages must remain documented and inert, outside keys, authorization, balances and consensus rules.
