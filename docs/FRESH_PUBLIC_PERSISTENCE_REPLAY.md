# Fresh public acquisition through persistence recovery

On 2026-11-12, the published acquisition tool was downloaded at `e6db8b3924514f400528d3479f32aca55a05e0d6` and compared byte-for-byte with the previously reviewed tool. It acquired all 20 pinned files into a fresh directory. The runner executed from that newly downloaded set, using existing trusted local Geth/Reth binaries and runtime.

The actual run passed the unchanged checks: isolated restart at genesis with destination identity preserved; recovery from a different replacement peer while the original source stayed stopped; 29 matching headers; 16 storage fields and five negative proof controls; all services stopped. No destination file import was used. The prior evidence directories were not overwritten.

This connects the download-only acquisition step to the real runner instead of testing them only separately. It does not constitute an independent operator or fresh-machine result: the same host, operator and previously provisioned client binaries were reused. Source-code reproducibility is distinct from reproducible binary builds, public-chain authentication, finality and power-loss durability. Independent R-04 remains environment-blocked; no broader acceptance is inferred.

Use [the public acquisition procedure](PERSISTENCE_INPUT_ACQUISITION.md), then its runner command. Retain failed attempts and record your own environment. The next independent validation should be another operator's run in an authorized tracing environment, not another equivalent same-host repetition.
