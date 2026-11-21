# Explicit local registry selection

The constructor boundary experiment showed that accepting a caller-supplied runtime hash does not establish trustworthy authority. This offline check instead requires an explicitly selected manifest digest before inspecting the candidate deployment. It adds no administrator key or on-chain allowlist.

The included manifest selects the existing28-operation local research fixture. It pins compiler input, compiler version, registry contract, initial owners, chain ID, deployer, nonce, deployment hash/address and expected runtime hash. It was prepared from the previously retained local fixture, not independently approved by the community. The checker does not generate or accept a replacement manifest automatically.

The verifier recompiles pinned input, derives expected initialization and runtime, recovers the deployment signer using ethers, and checks the exact selected signed deployment. Three altered records reject: a changed transaction hash label, a failed-status label and a different signed deployment. A separate wrong-manifest-digest control rejects before compilation. The matching result is local candidate selection, not chain inclusion or consensus authentication.

## Reproduce

Use the existing solc0.8.30, ethers6.16.0 and Node20.20.2 dependencies:

```sh
node --max-old-space-size=256 integration/core-baseline-v1/check-registry-selection.mjs evidence/registry-selection-20261109/manifest.json 33673024dbf0d57084e36cd62e8b9518f3fc6c346cf1807a71ba8b07e690a56a evidence/registry-withdrawal-verification-20261109/input/compiler-input.json evidence/registry-withdrawal-verification-20261109/input/operations.json
```

Review and choose the manifest digest independently; do not calculate it from an arbitrary incoming manifest and call that trust. The published digest identifies our research choice only. A self-consistent dishonest registry and matching self-chosen manifest remain outside this guarantee.

## Authority and dependency boundary

For this selected source, ownership changes are authorized by owner/approval/operator; transfers increment epochs. Constructor owners initialize accounts1–4. The registry has no later mint, administrator setter, upgrade/proxy path or external authority provider in this source. Safe-transfer receiver callbacks can forward ownership and must be included in review. Custody still depends on token behavior, registry behavior and supplied stake-root policy; the manifest does not make those policies correct.

Production selection still needs publicly reviewable initialization and dependency evidence, an independently trusted chain anchor and authenticated deployment/code/state, ongoing reconstruction of authorized ownership changes, and explicit release agreement. A supplied receipt status is not proof of execution. Compiled runtime expectation is not a live code proof. Immutable code can still contain unsafe policy or depend on mutable external state.

NEXT bind selection to authenticated deployment evidence using existing readers, keeping local reproduction separate from public-chain acceptance. No constructor policy, production registry or protocol rule is changed here. README remains paused.
