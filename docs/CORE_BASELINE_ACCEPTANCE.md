# One-command frozen research acceptance

From a reviewed checkout, with the manifest-pinned solc package, ethers6.16.0 and the separately pinned Geth evm tool available:

`python3 integration/core-baseline-v1/accept-core-baseline.py /absolute/path/to/checkout /absolute/path/to/evm /absolute/path/to/new-output`

This command requires Linux, keeps existing disk/memory safeguards (including the Windows host-drive check under WSL), rejects an existing output directory and retains each step log. Python assertions must remain enabled. It performs no network acquisition, wallet operation or deployment.

1. Validate the frozen public replay input hashes with the existing comparison runner.
2. Rebuild and compare all three baseline artifacts with the pinned compiler/input. Save the checked compiler output to a new file.
3. Parse the replay package's signed creation transactions and require exact rebuilt creation bytes plus canonically encoded frozen constructor arguments. Match all four derived addresses and transaction hashes to the deployment manifest.
4. Run the pinned Geth transition comparator over all38synthetic blocks and require its existing checks to succeed. Save an aggregate research acceptance receipt only after all stages pass.

FACT — The combined command passed with freshly fetched public inputs at the parent in provenance: three artifact rebuilds, four signed creation bindings and38Geth transitions. This reruns Geth against previously recorded EthereumJS expectations; it is not a new dual-engine run or fresh signed-lifecycle acquisition. Previous original-Anvil root discrepancies remain preserved. Synthetic genesis/timestamp adjustments remain part of this package; canonicality/finality is not asserted.

The command is deliberately limited to this frozen research package. The compiler input carries mock-token and fixed-account source, and acceptance does not resolve C-001, economics, NFT registration, scalable staking, arbitrary-wallet support or production deployment. Checked hashes must themselves arrive through a reviewed source channel. No full-suite or external audit is claimed. Test results from other historical contract variants are not automatically included.

Next integration task: use this command as the baseline gate while producing the versioned specification/parameter decision register. Then change a single agreed contract behavior and rerun the integrated evidence rather than expanding unrelated research. Fresh EthereumJS/lifecycle replay and the broader adversarial matrix remain separate gates. README updates remain paused.
