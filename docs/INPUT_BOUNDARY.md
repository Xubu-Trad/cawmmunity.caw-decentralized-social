# One meaning before use

Alpha.45 adds a bounded JSON admission step to the browser's environment, fixture and retained-checkpoint inputs. A duplicate field is rejected even when its last value would satisfy the schema. For example, a configuration containing both `"mode":"mainnet"` and `"mode":"simulation"` cannot become an accepted simulation configuration by silently dropping the first field.

The recognizer checks the complete JSON grammar, decoded member-name uniqueness within each object, a UTF-8 byte budget, at most 32 nested containers and at most 100,000 items. Every value, including a container, and every object member name counts as an item. Escaped names compare by their decoded strings; Unicode normalization is never applied. Names in separate objects do not conflict. Trailing data, comments, trailing commas and a leading byte-order mark are rejected. The returned values retain native JSON number/string semantics, including rounding of large numbers and unpaired escaped surrogates; callers must still validate values and Unicode according to their own schemas.

| Entry | UTF-8 limit | What follows admission |
| --- | ---: | --- |
| Environment manifest | 4 KiB | Existing simulation-only schema |
| Bundled synthetic fixture | 64 KiB | Existing model and seed validation |
| Retained checkpoint, binding, permission and owner fields in Readers | 4 KiB each, with the existing 1,024 UTF-16-code-unit UI limit | Existing checkpoint, delegation, owner and signature validation |
| Generic parser ceiling | 1 MiB | Caller-specific validation is required |

The network reader counts bytes before retaining each chunk, uses a fixed bounded buffer, rejects invalid UTF-8 and attempts cancellation and lock release on every acquired-reader exit. Cleanup failure does not replace the primary failure. Requests use a five-second abort signal, omit credentials and referrers, reject redirects and disable caching. The app requests only its relative environment and fixture files; it supplies no alternative remote endpoint on failure.

`parseBoundedJson` accepts text, not arbitrary objects or accessors. `readBoundedJson` assumes native response streams and unmodified platform built-ins. The byte limit bounds retained payload, not the browser's transport buffers. The parser itself performs no authentication, signature verification, normalization, repair, request or state adoption. A digest match still needs an independently retained comparison target.

Canonical signed records, anchor packages and protocol readers retain their existing parsers, byte comparisons, limits and validation. JSON parsing of internally generated snapshots is unchanged. The new boundary is not a claim that every parser in the repository shares one implementation or has been formally verified.

Run the focused checks with Node.js 24.20.0:

```sh
node --max-old-space-size=256 --test --test-isolation=none --test-concurrency=1 --test-timeout=30000 tests/bounded-json.test.mjs tests/deployment.test.mjs tests/build.test.mjs tests/server.test.mjs
```

The tests compare accepted grammar cases with native parsing, reject escaped duplicate aliases, exercise structural and byte limits, and check stream cleanup and actual environment/fixture integration. See [validation](VALIDATION.md) and the [current receipt](../evidence/TEST_RESULTS.json). Passing finite cases is not a proof of parser equivalence or a production audit.
