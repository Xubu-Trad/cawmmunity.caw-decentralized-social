# Refreshed package: actual local recovery

On 2026-11-12 the acquisition script was fetched from `2a26b86ae4287eb075ed76fbf2575c4dcc57046c` and compared with the reviewed bytes. It downloaded and verified all 20 refreshed files into a new directory. The downloaded runner then completed using the existing trusted local Geth and Reth runtime.

The destination was interrupted during the persistence experiment and restarted at head 0, with identity preserved, no connected peers and the target absent. Recovery used a replacement peer with a different identity while the original source remained stopped. No destination file import was used. All 29 headers matched; 16 storage fields verified against the selected header; all five negative controls rejected (header root, header hash, wrong value, missing proof, altered node). All test services stopped.

The exact experiment input commit is `e250e4061dd822c1a3dc9bf7627343753ebc7ba3`, with inventory fingerprint `68129c10f2d6da410c07e1cfb61584fea5ba1a68ce232c2cd0c6458374d273f4`. This checks the refreshed runtime policy and wrapper together with actual clients, beyond the earlier mocked tests.

## What this does not prove

This is the same host and operator using previously provisioned binaries, ordinary Python and synthetic chain data. It is not an independent-operator or clean-machine result, power-loss test, reproducible client build, authenticated public-chain history, finality proof or production acceptance. Prior evidence and failed lanes were preserved.

## Independent next step

Use [the refreshed package instructions](REFRESHED_RECOVERY_PACKAGE.md) at their pinned revision. Another operator should retain the acquisition/provenance records, preflight inventory, stage exit records, recovery and strict-reader reports, and failed attempts. Record whether hardware, operator and client provisioning are genuinely separate. Review artifacts for private paths or credentials before sharing them; do not publish wallet material. A blocked tracing environment remains blocked, not a reason to bypass the verification checks. No further equivalent same-host run is needed solely to inflate the evidence count.
