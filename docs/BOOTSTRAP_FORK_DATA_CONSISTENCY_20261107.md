# Minimal Capella fork-data consistency — 2026-11-07

Status: research fixture verification only. No live-chain authentication or release approval.

## Sources and results

FACT — Parent community commit: `3bf313c20633e972dca1fd1a03490ee2d807fe30`.

FACT — The pinned minimal Capella configuration and metadata produce SSZ ForkData root `856842be987cb7f12d34e84282045bdf06fb0c6a88889e41b889ca90dd583c92`, with four-byte fork digest `0x856842be`.

FACT — The operator's saved WSL results separately report seven passing Python oracle checks, nine initial JavaScript checks, and thirteen corrected JavaScript checks. Two intermediate boundary observations confirmed that V1 admitted an extra config authority field without adopting it, and that a coherently changed fork version and digest could pass the consistency calculation.

FACT — The corrected verifier requires the exact 46-key configuration layout of this retained fixture. An extra or replaced config key now rejects. The V2 patch attempt failed on a whitespace-sensitive source marker, and its subsequent nine-test run did not satisfy the requested thirteen-test gate. That failed attempt is preserved locally; V3 applied the isolated marker correction and passed 13/13.

The V3 source files were sealed at SHA-256 `fcae14704319a6da56eb170fbd8f7367e715e6afeb291a3a0d59ba29540db45d` (module) and `8ef536dac5c053994a88fef9a4593f30b6b8708509a75278b5aa0b80d207aaf8` (tests). The corrected test log SHA-256 is `37cb53a8757a1f49bca3bba9b27d8b2c8174d97a41e66345e658794279b18d9d`. The retained operator manifest SHA-256 is `9412ba4cdf441fecc36c68c926e327e013402d1b7f6e7ac55fbd2700a8e8b9b3`.

## Limits

INFERENCE — The calculation proves compatibility between supplied configuration bytes, supplied metadata bytes and the computed digest. It does not establish that either input is authoritative. Recomputed caller-supplied SHA-256 values are not an independent trust anchor.

The 46-key layout check does not validate every configuration value. The selected Capella fork version and activation epoch are parsed, but the module does not establish a real fork schedule. A coherent alternative version/digest is still admitted as data consistency and remains unauthenticated. Changing a non-selected value such as seconds per slot can also leave this narrow check passing.

Root authentication, independent network acquisition, verified fork schedule, BLS key/signature validation, consensus, finality, update acceptance and production acceptance remain unestablished. Every corresponding acceptance flag returned by this research verifier remains false.

The saved operator tests used Node v20.20.2 and Python 3.10.12. The repository declares Node 24.20.0; no test on that exact declared runtime or full-suite run is claimed.

Historical V1 source and boundary logs are retained under `evidence/bootstrap-fork-data-20261107/`. The old boundary probe intentionally describes V1 behavior and must not be treated as a passing regression against the corrected V3 verifier. Individual checks establish only their stated cases, not exhaustive parser safety.

Next gates: independently justified checkpoint origin, real network/fork policy, freshness rules, cryptographic validation and operator-independent recovery. Hosted CI remains deferred; public-test and production gates remain blocked.
