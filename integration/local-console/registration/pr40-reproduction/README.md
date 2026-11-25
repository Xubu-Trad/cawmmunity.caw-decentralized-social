# Reproduce PR #40’s authority checks

Use Linux with Bash, Git, tar, sha256sum, Python 3, Node.js 20.20.2, npm 10.8.2 and Anvil 1.5.1 (b0a9dd9ceda36f63e2326ce530c10e6916f4b8a2) on PATH. npm needs network access for the two locked installs. The fixture starts its own loopback node on a free port and closes it on exit. No browser, existing node, funded wallet or keys are required.

Start from a new checkout. For review at a fixed revision, use the packet commit linked in PR #40 before running the last command:

```sh
git clone --single-branch --branch product/disposable-runtime-manifest https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social.git caw40
cd caw40
bash integration/local-console/registration/pr40-reproduction/reproduce.sh
```

The runner verifies the packet hashes, extracts the exact tested source commit `44cd8d854d1ffe37de6a2c2289107945897e1bdb` from Git into a fresh temporary directory and runs the real deployment fixture. The packet commit and tested source commit are separate pins. Shallow checkouts must fetch the tested source commit first.

The fixture checks all seven runtime hashes, 21 EIP-1967 slots, the expected contract wiring and the runtime instruction scan. It checks the original username owner and verifies that reader01 belongs to the buyer at epoch 2. It must reject simulated changes to each vault proxy slot, the reCAW dependency, the vault code and the final checkpoint. Some assertions run after the report is printed. A successful comparison requires the fixture to exit zero.

The earlier local run in reference.json records block 31. The operator's checkpoint hash can differ on a fresh chain. The runner compares the height, seven roles and full authority report, including dependency addresses and the hunter01 record. Its output directory retains the local checkpoint, versions, installation and execution logs, fixture exit code and checksums. If a step fails, the runner exits nonzero and retains the available logs. Share the revision, command, exit status and resulting hashes when reporting an independent run.

This reproduces the disposable-chain assessment using the selected node. Public-chain authority, independent checkpoint provenance and community acceptance remain open.
