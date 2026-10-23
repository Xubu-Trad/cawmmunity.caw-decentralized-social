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
