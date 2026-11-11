# Persistence reproduction preflight

The preflight checks the fixed 14-file input set and inventories explicitly trusted tools **before starting test nodes**. It is preparation for independent reproduction, not an independent review or recovery result.

## Fixed-input check

The accepted snapshot is `54f872c70be7173be434e611bff7e8aab10195f0`. The canonical JSON inventory fingerprint is `e3dce5976a933d2db2ae77dea09cab029573d4132be9b9f796c889f0e0b52d26`. JSON key order and whitespace do not affect this fingerprint. An edited inventory cannot silently redefine accepted inputs. Every file must remain inside the selected source directory and match the pinned size and SHA-256. Missing or altered inputs reject. The pin is a research reference, not decentralized consensus or an authenticity attestation.

## Run

Use the preflight script and inventory from this research revision, and SOURCE_CHECKOUT pointing to the fixed snapshot above. The preflight files can be kept separately from that checkout.

```sh
python3 integration/peer-sync/persistence-preflight.py --source "$SOURCE_CHECKOUT" --manifest evidence/public-persistence-replay-20261111/inputs.json --geth "$GETH" --reth-command "$RETH_COMMAND_JSON" --output "$FRESH_PREFLIGHT_JSON"
python3 integration/peer-sync/test-persistence-preflight.py --source "$SOURCE_CHECKOUT" --manifest evidence/public-persistence-replay-20261111/inputs.json
```

The output must be new. Python 3.10+ is required. GETH and RETH_COMMAND_JSON are explicitly trusted executable/runtime selections: version queries execute them. This is not a hostile-program sandbox. On a successful preflight, follow [the combined recovery command](PERSISTENCE_SYNC_REPRODUCTION.md) using the fixed checkout and a fresh execution directory. Do not skip that command or its strict reader because preflight passes.

## Evidence

Five focused checks passed: genuine inputs accepted; altered input, missing input, modified inventory and external symlink rejected. Tests use temporary copies and leave source inputs intact. The actual version/hash inventory completed without starting nodes: Geth1.17.10, Reth2.10.1, Node20.20.2, strace5.16 and Python3.10.12. Full executable/loader fingerprints are in evidence/persistence-preflight-20261111/inventory.json. These are observations of this host, not approved binary hashes or proof of reproducible builds. Version differences on another host require explicit reporting and review, not silent equivalence.

## Remaining boundary

The tool does not inventory every loaded shared library, attest compiler provenance, lock files against replacement after checking, validate all strace features or replace the driver's resource guards. Its explicit inventory pin applies only to this finite experiment. A reviewer still needs trusted tools, a stable source checkout, the actual recovery run, strict proof output, filesystem context and a statement of operator/host independence. Existing recovery results are unchanged; no fresh node run or expanded durability claim is made here.

Independent operator reproduction, fresh toolchain validation, public-chain authentication/finality and production readiness remain pending. Share only reviewed receipts: version outputs can contain local configuration on another machine, and jwt.hex or credentials must not be uploaded.
