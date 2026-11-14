# Constructor acceptance and registry trust boundaries

FACT —26 signed local transactions exercised constructor rejection and registry behavior against the existing experimental custody logic. The earlier source remains unchanged. A separate source appends an intentionally dishonest test registry; it is not a proposed production dependency.

## Constructor results

| Input | Observed result |
| --- | --- |
| Zero token address | Rejected, empty revert data |
| Token address with no contract code | Rejected, empty revert data |
| Zero payer | Rejected, empty revert data |
| Zero registry address | Rejected with REGISTRY |
| Registry address with no code | Rejected with REGISTRY |
| Wrong registry runtime hash | Rejected with REGISTRY |
| Zero snapshot root | Accepted; claim usability not established |
| Contract with matching hash but no authority function | Accepted at construction; later authority read rejected |

The constructor checks code existence and equality to a caller-supplied hash. It does not establish that the selected contract implements the required authority behavior, that its state is honest, or that the supplied snapshot represents valid stake. Acceptance must not be presented as validation of those properties.

## Withdrawal failures

After funding5 mock units and claiming1 unit for account2, the dishonest registry was configured independently to return a zero owner, revert, or return only32 bytes instead of the owner/epoch pair. Withdrawals respectively returned ZERO_OWNER, REGISTRY_UNAVAILABLE, or empty revert data. Checked token balances, account credit, credited/unallocated liabilities and unpaid liability stayed unchanged. These are reverted transactions; native gas and sender nonces still advance.

## Same code, dishonest authority

The test registry's unrestricted setter lets an unrelated wallet replace reported ownership while keeping epoch0. Its runtime hash is identical before and after this state change. The prior owner then receives OWNER; the newly reported owner successfully withdraws the1-unit account credit. Final balances are payer95, unrelated wallet1, custody4; remaining unpaid liability and unallocated rewards are4, with credited liability0.

INFERENCE — before/after owner-and-epoch checks protect against changes observed during a payment, but cannot authenticate an already dishonest registry. Runtime pinning detects code mismatch, not every state mutation or mutable dependency behind that code. This does not demonstrate an unauthorized-transfer defect in TestAccountRegistry, which has different authorization rules. It is not evidence of a live theft.

## Reproduction

Use existing pinned dependencies Node20.20.2, solc0.8.30, ethers6.16.0 and EthereumJS10.1.3. From repository root, choose a fresh output directory:

```sh
node --max-old-space-size=256 integration/core-baseline-v1/test-registry-boundaries.mjs integration/core-baseline-v1/RegistryBoundaryResearch.sol /tmp/caw-registry-boundaries evidence/funded-claims-20261108/vectors.json evidence/funded-claims-20261108/proofs.json
```

The test uses public disposable wallet keys3/4 and a mock token. Never fund them. Compiler source key FundedAdmissionResearch.sol is retained intentionally. Generated operations and compiler input remain locally preserved with published hashes; the harness regenerates them. Existing resource limits were retained.

## Required selection evidence and next work

UNRESOLVED — a production candidate needs a reviewed, exact registry implementation and initialization, authenticated deployment/state evidence, and an inventory of any proxies, delegates, external authority sources or mutable dependencies. A deployer supplying an arbitrary matching hash is not that evidence. A one-time successful authority probe would improve error detection but would not prove future honesty. No administrator allowlist or recovery key is proposed as a substitute.

IDEA — test an immutable, manifest-bound registry selection against these same negative cases, while keeping selection policy distinct from the registry's authorized ownership transfers. Determine whether deployment should reject missing authority ABI and unusable roots before changing constructor policy. A zero root is currently accepted, not silently reclassified as a valid stake snapshot.

This26-operation history has single-engine coverage only. The separate28-operation reader/Geth result does not cover it. Independent reconstruction, second-engine comparison, public-chain authority evidence, real CAW compatibility, registration and adoption of the economic rules remain separate gates. README updates are paused.
