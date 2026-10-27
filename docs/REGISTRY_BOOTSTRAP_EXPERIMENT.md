# identical registry code, different bootstrap authority

FACT -- 11 grouped checks passed on a disposable local Anvil1.8.1 London chain31337. the two unchanged TestAccountRegistry deployments used reversed constructor owner arguments. their runtime bytes were identical, with Keccak256 `0x5bd17d0ec2568d04b7edcefb86de6aec5a54f84845004f6630b43c18d83d852d`, but account1 had a different initial owner in each. both epochs started at zero.

two unchanged paid probes accepted that same expected registry hash and exposed their respective immutable registry addresses. this demonstrates why a code pin does not authenticate the intended initial allocation. the probes themselves have different registry-address immutables; no identical-probe-runtime claim is made.

| checks | observed result |
| --- | --- |
| registry pair | byte-identical runtime, distinct account1 owners, epoch zero |
| two probe bindings | selected registry address and common runtime hash match |
| wrong expected hash | constructor rejects with RegistryCodeChanged |
| nonowner on each probe | NotAccountOwner |
| current owner on each unfunded probe | InsufficientCredit, after the ownership/epoch checks |
| left registry transfer | epoch becomes1; stale-epoch new-owner request rejects |
| old owner at epoch1 | NotAccountOwner |
| new owner at epoch1 | InsufficientCredit |
| final isolation | registry runtime remains identical; other registry authority unchanged |

these rows summarize 11 assertions/groups, not 11 independent security proofs. all attempted withdrawals reverted; no token contract was installed, no token moved, and no successful funded withdrawal was tested. actors were locally impersonated and given synthetic gas balances. this is contract-control-flow evidence, not signature or external identity proof. no remote provider was contacted. the owned node stopped after the run.

## reproduce

from a Windows checkout, use Python with the existing cryptography dependency and the pinned Windows Anvil1.8.1 binary:

```text
python -B experiments/registry-bootstrap/run.py --anvil <path-to-anvil.exe> --output <new-output-directory>
```

[runner](../experiments/registry-bootstrap/run.py), [results and source pins](../evidence/REGISTRY_BOOTSTRAP_RESULTS.json). the runner checks the retained build and its source identities, compares deployed bytes with that build, and uses the existing guarded node. it does not recompile Solidity or independently attest the compiler. startup requires768MiB available memory and2GiB free disk; the owned node has a512MiB process cap, bounded requests/logs and an additional300second request deadline. output directories must be new. failed results and local traces are retained, never overwritten. the raw trace is not published in this increment; its digest is recorded and a fresh reproduction generates its own trace. local block timestamps can change transaction/trace hashes across runs.

INFERENCE -- unchanged runtime logic can serve different initial ownership states. immutable selection prevents a later caller from switching this probe's registry address; it does not decide which initial allocation, chain or state was legitimate. another builder needs independently verifiable deployment and state evidence as well as code identity.

UNRESOLVED -- all seven [production registry/bootstrap gates](REGISTRY_BOOTSTRAP_REVIEW.md) remain OPEN. there is no production registry, canonical-state selection or permissionless registration decision here. this experiment adds no mainnet, funded-withdrawal, full-state-root or independent-operator certification. prior suites were not rerun.

next: bind an independently verified registry owner/epoch state proof to the explicitly selected registry code and state root in the existing reader. retain competing-state and wrong-registry/root negatives; keep selection provenance/finality explicitly unverified. independent executor reproduction remains a separate open task.
