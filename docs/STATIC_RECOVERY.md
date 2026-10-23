# Verify a copied alpha website before hosting

The alpha website can be copied without the original host. The new checker verifies its fixed set of 22 assets plus `SHA256SUMS.txt` against a manifest SHA-256 retained separately from the received copy. It does not run any received script or contact a service.

Use a trusted copy of the verifier and build scripts from the reviewed source commit. With Node 24.20.0:

```sh
node scripts/build.mjs
node scripts/check-static-dist.mjs /path/to/copied-dist RETAINED_MANIFEST_SHA256
```

The build command outputs `manifestSha256`. Retain that value with the selected source commit before transferring the build. The checker requires exactly two arguments; substituting a digest calculated from an untrusted received manifest defeats the intended replacement check. Matching the digest authenticates neither its supplier nor the chosen source commit.

For the unchanged public assets at source baseline `2b56f61a341da8ddb6af89904c736f7429e68197`, the recorded manifest digest is:

```text
c4916abc6e35579d89d367eb8368ddcb4d677830c35eed30584ea4da796d4374
```

This is a reproducible comparison target for that asset set, not an assertion that this GitHub account is an independent trust root. Future asset changes require a new reviewed digest; the checker never fetches or updates it automatically.

The checker rejects missing/extra entries, changed assets, a replaced manifest, noncanonical or duplicate manifest names, traversal names, directories in place of files and oversized input. It only reads fixed member names. Individual assets are limited to 1 MiB, except the symbol image at 2 MiB; the manifest is limited to 4 KiB. Direct symbolic-link entries are rejected. The local filesystem must not be changed concurrently, and its parent directories remain trusted: this is not an operating-system sandbox or a race-resistant hostile-filesystem verifier.

Success reports byte integrity relative to the supplied pin. `originAuthenticated`, `hostedContentVerified`, `protocolVerified` and `productionAccepted` remain false. A host can serve different bytes after verification; this command checks local files, not responses from a deployed website. Do not put secrets in the static directory.

## Evidence and remaining work

See [recorded validation](../evidence/STATIC_RECOVERY_TEST_RESULTS.json) for the exact source hashes and test counts. Fresh temporary-directory copies and a separate CLI execution were checked on the same machine. That is not an independent builder reproduction or proof of continued network availability.

OI-01 in [operator independence](OPERATOR_INDEPENDENCE.md) remains open: another builder must reconstruct the selected source/build and serve it without original credentials. Protocol history, account authority and chain authentication remain separate gates in the [recovery trust model](RECOVERY_TRUST_MODEL.md). This increment does not change contracts, economics, source interpretations or deployment status.


## Reproducible portable archive

```sh
node scripts/package-static.mjs /path/to/new-alpha.tar
```

The output path must not already exist. The command packages only the builder's 22 fixed public assets and checksum manifest. POSIX ustar headers use fixed ordering, mode 0644, uid/gid zero, zero modification time and empty owner names. No compression, current timestamps, local paths, credentials or private workspace files are included. Identical input bytes produce identical archive bytes.

The recorded unchanged asset set produces archive SHA-256 `d277ba5dc919324716e178b1623ade1cbd2e505be3b1576b218ec75d0619ad31`. Verify a received archive against a separately retained digest before unpacking it, then use the static-directory checker with the retained manifest digest. A hash supplied only alongside an unknown archive does not authenticate it. This archive is an alpha website package, not a protocol deployment or complete research/source backup.

The optional interoperability experiment uses Python's standard-library tar reader:

```sh
python scripts/test-static-archive.py /path/to/new-alpha.tar /path/to/trusted-dist /path/to/new-roundtrip-directory
```

Use this on the locally generated bounded archive and a trusted build directory. It checks every member's bytes and metadata and writes validated plain filenames into a new directory. It is a test recipe, not a general hostile-archive extractor. Python is optional for this check; packaging and ordinary static verification still use only Node.

[Recorded validation](../evidence/STATIC_PACKAGE_TEST_RESULTS.json): two in-memory builds matched; the CLI produced the same archive fingerprint; Python recovered all 23 files exactly. The full offline suite passed 1081 checks across 52 files. These remain same-machine results, with no independent operator, public hosting or production acceptance asserted.


## Replacement-host experiment

The [loopback recovery test](../tests/static-host-recovery.test.mjs) copies the release files into a fresh temporary directory and starts a separate minimal test host. It never imports the original app server or uses its public-directory routes. Every file is requested at `/restored/` and compared against the retained build hash; MIME types and HTML relative-asset destinations are checked. A deliberately corrupted hosted script rejects even when the local files and served checksum manifest are unchanged. This demonstrates why local verification alone cannot certify hosted responses.

Three focused tests and [1084 offline regressions](../evidence/STATIC_HOST_RECOVERY_TEST_RESULTS.json) passed. The host is an ephemeral test fixture, not a recommended public server. This experiment does not execute browser JavaScript, validate rendering, obtain independent operator evidence, or prove future availability. OI-01 remains OPEN for independent reproduction/distribution. Do not reinterpret successful loopback HTTP checks as a public deployment or protocol recovery.
