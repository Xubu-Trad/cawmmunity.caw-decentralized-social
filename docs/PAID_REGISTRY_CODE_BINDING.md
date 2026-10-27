# selected paid-contract and registry code binding

FACT -- 17 focused groups pass against two freshly acquired local contract pairs. each pair contains a registry owner/epoch proof and a paid-contract account/code proof at the same selected block. the registries have identical code and different initial owners; the paid contracts differ in their immutable registry address. direct calls are retained for comparison but are not inputs to the binding reader.

the new Node-only fixture reader verifies the exact retained paid-build.json SHA256, patches all compiler-recorded registry/address and registryCodeHash immutable locations in that fixed runtime template, and derives the expected code hash. it requires the paid contract's committed code to match that expectation byte for byte. the existing header/account/code reader verifies this code against the selected paid-contract address. the existing registry state reader verifies owner/epoch and fixed registry code at that same selected header hash. callers cannot supply a runtime template, code-hash override or finality claim.

the compiler output is trusted retained input, not freshly or independently reproduced here. template identity and immutable location checks do not establish that the compiler faithfully compiled the Solidity source. the module is under experiments/; no frontend or recovery adoption path calls it.

## observed checks

| case | result |
| --- | --- |
| two correctly selected pairs | binding and decoded owner/epoch match retained direct calls |
| different valid registry proof plus its correct address, original paid contract | rejects: paid runtime does not bind that registry |
| different valid paid proof plus its correct address, original registry | rejects: immutable address does not match |
| wrong paid address, changed runtime or claimed code hash | rejects |
| changed header root or retained block hash | rejects |
| missing registry epoch witness | rejects |
| supplied runtime override, finality claim, duplicate key, oversized evidence or object input | rejects |

the 17 groups also verify capture scope and common-header/different-binding observations. these are finite local tests, not independent audits. all returned authority, permission, execution, endpoint-authentication, consensus, finality, freshness and production acceptance flags remain false. initialAllocationAccepted and compilerReproductionVerified are also false; selectedFixtureBindingVerified has only the scope described above.

## reproduce

```text
node --max-old-space-size=256 experiments/registry-bootstrap/check-binding.mjs experiments/registry-bootstrap/binding-capture.json
```

[reader](../experiments/registry-bootstrap/binding-reader.mjs), [checks](../experiments/registry-bootstrap/check-binding.mjs), [synthetic capture](../experiments/registry-bootstrap/binding-capture.json), [results and source identities](../evidence/PAID_REGISTRY_BINDING_RESULTS.json).

fresh acquisition on Windows requires the existing Python cryptography dependency and pinned Anvil1.8.1:

```text
python -B experiments/registry-bootstrap/capture-binding.py --anvil <path-to-anvil.exe> --output <new-directory>
node --max-old-space-size=256 experiments/registry-bootstrap/check-binding.mjs <new-directory>/capture.json
```

the capture deploys unchanged retained contract bytecode on disposable London31337. locally impersonated actors receive synthetic gas; there is no public RPC, token deployment, funded withdrawal or signature proof. four exact scoped proof requests cover two registry owner/epoch states and two paid-contract accounts with empty storage selections. memory/disk/process guards remain unchanged; an additional300second request deadline applies. the node is stopped after capture. the complete request trace remains local, with its digest retained in the published synthetic capture. private paths and credentials are not part of that capture. prior suites were not rerun.

INFERENCE -- a correct registry proof cannot alone establish which wallet contract uses it. this composition checks that missing relationship for the fixed fixture and explicit selection, without relying on an unproved getter response. it still cannot tell the user which deployed contract or state should be trusted.

UNRESOLVED -- no creation transaction/source provenance, current-chain authority, token behavior, funds accounting, production registration or release agreement is established. all [registry/bootstrap production gates](REGISTRY_BOOTSTRAP_REVIEW.md) remain OPEN. next reconcile existing paid-ledger history and endpoint-state evidence with this binding; inventory what state is already checked before adding another reader. a selected owner and code binding do not prove balances or withdrawal safety. independent executor reproduction remains a separate open task.
