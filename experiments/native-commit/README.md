# database commit reproduction candidate — unexecuted

This small Rust harness calls the actual `revm-database =42.0.0` commit implementation, using `revm-state =42.0.0` account flags. It does not reimplement the database algorithm. Both direct package versions match the reviewed Foundry lockfile. Remaining dependency resolution is not yet locked or verified; no Cargo.lock has been generated.

**Status: prepared and source-reviewed only. No compiler, test pass, or failing oracle result is claimed.** The checked local Windows and Linux environments did not expose a Rust compiler. Do not add these cases to published pass counts.

Four characterization cases cover untouched absence, touched-empty retention, self-destruct deletion and a nonempty balance. A fifth, explicitly ignored oracle tests desired touched-empty deletion. Run it separately: its expected failure is a hypothesis from source inspection, not yet observed evidence. A green characterization suite would confirm the described behavior, not approve it.

On a resource-bounded Rust 1.91+ environment:

```text
cargo test --manifest-path experiments/native-commit/Cargo.toml --jobs 1 --test commit -- --test-threads=1
cargo test --manifest-path experiments/native-commit/Cargo.toml --jobs 1 --test commit -- --ignored --test-threads=1
```

Retain both exit codes and complete logs, compiler identity, generated Cargo.lock and dependency checksums. Review the resolved graph against the pinned Foundry lock before treating this as a matching dependency reproduction; then rerun with `--locked`. Do not weaken the existing resource guards to run it.

The harness supplies synthetic account flags directly. Even a successful run would not prove that Anvil emitted those same flags during the captured transaction. That requires journal-level reproduction or instrumentation. No full EVM execution, consensus certification, live-chain conclusion or production readiness follows.

See [the source review](../../docs/NATIVE_COMMIT_REVIEW.md) and [the retained one-leaf diagnostic](../../docs/NATIVE_LEAF_CONTROL.md). Existing accepted/rejected evidence is unchanged.
