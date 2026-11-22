# Replay resource checks on Linux and WSL

The frozen-fixture Geth runner now selects the destination filesystem from the resolved output path, walking to its nearest existing parent before creating output. Every Linux run requires at least **2 GiB free there**. A WSL kernel additionally requires `/mnt/c` to be mounted and to have at least **2 GiB free**. Missing WSL host access never silently falls back to the Linux filesystem. This retains the existing C: requirement and adds the destination check.

Both paths still require at least **768 MiB MemAvailable** from `/proc/meminfo`. Missing, duplicate or wrongly labelled observations fail closed. Non-Linux hosts are rejected. Runtime limits remain 512 MiB child RSS and 180 seconds, with Geth's 256 MiB memory target. Python optimized mode remains unsupported. These are startup observations, not disk reservations or full container/cgroup memory accounting.

## Verification

Eleven mocked platform/resource boundary checks pass: exact-threshold acceptance, both WSL filesystems, low native disk, low host disk, low destination disk, missing WSL mount, low memory, missing memory, wrong units, duplicate memory and non-Linux rejection. Eight existing frozen-input checks pass. The real WSL run reproduces all 26 transitions and final native balances, retaining six comparison/execution controls.

The first platform-test attempt failed because its test helper patched `os.path` instead of `os.path.ismount`. That failed lane was preserved, the test helper corrected, and the cases rerun. The production helper was not changed to accommodate that error.

**Native Linux execution has not been performed.** Its selection logic has mocked coverage; actual execution evidence remains WSL on the same machine/operator. This does not establish outside reproduction, container support, consensus authentication or production readiness.

## Run the focused platform tests

```sh
python3 experiments/c007-transactions/check-replay-resources.py experiments/c007-transactions/compare-geth-transition.py /absolute/path/to/new-platform-check-output
```

The test script first checks real machine resources, then uses mocks for the boundary cases. The [frozen fixture guide](../evidence/c007-frozen-replay-20261108/REPRODUCE.md) still supplies the replay command. On native Linux the runner checks the output filesystem without requiring a Windows drive; on WSL it checks both. An independent builder should report their exact checkout, kernel, publisher-verified binary digest and matching fixture hashes alongside results or failures.
