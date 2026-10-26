# Fresh-process selected execution

FACT -- eight separate guarded Node processes exercised the new one-request CLI. Two normal invocations produced byte-identical result files (selected local storage increment, execution-completed, gas 26012). Wrong source digest, wrong executor digest, oversized input, invalid UTF-8 and malformed JSON each exited nonzero and produced no result file. A pre-existing output caused refusal and remained byte-identical. These are eight process cases, not eight new protocol features or a repeat of every replay fixture.

The CLI reads a regular input file with a one-MiB bound, using a fixed one-MiB-plus-one buffer and strict UTF-8 decoding. It invokes the fixed source-selected executor, checks its input digest against the exact read bytes and writes a JSON envelope by exclusive creation. Existing results are never overwritten. Stdout may contain engine entrypoint observations; the explicitly named result file is the result channel, not stdout. Errors emit a fixed diagnostic and nonzero exit.

From experiments/execution-engine after the frozen installation, using Python 3.12 and Node 24.20.0 with default conditions:

```text
python -I -B prepare-process-input.py ../.. process-input
node --max-old-space-size=256 selected-executor-cli.mjs ../.. process-input/valid.json 81c71fc5cbeda8eebe8207a3a4a83320a796df5946d2d6017c8f06114a65ec0f 73f50a25dced2047c87c30a4337bcdd6a9730c1352c2164ee998ae36df55fc50 first-result.json
node --max-old-space-size=256 selected-executor-cli.mjs ../.. process-input/valid.json 81c71fc5cbeda8eebe8207a3a4a83320a796df5946d2d6017c8f06114a65ec0f 73f50a25dced2047c87c30a4337bcdd6a9730c1352c2164ee998ae36df55fc50 second-result.json
```

Compare the two complete result files byte-for-byte. For each negative case use a fresh output path: replace either expected digest with 64 zeroes, or use oversize.json, invalid-utf8.json or malformed.json. Expect nonzero exit and no output. Repeating the valid command with first-result.json as output must fail without altering that file. The fixture preparer refuses an existing output directory. Review source before running; local supervision used the existing startup/disk, hard process-memory, deadline and output limits. The CLI's heap flag alone does not provide those supervisor guarantees.

[CLI](../experiments/execution-engine/selected-executor-cli.mjs), [results](../evidence/EXECUTOR_PROCESS_RESULTS.json), [selected executor boundary](SELECTED_EXECUTOR.md). Original input, stdout/stderr and process receipts are retained in the private evidence lane; public records expose hashes and bounded case results rather than machine paths.

INFERENCE -- separate invocations avoid sharing a previous request's JavaScript module cache in this experiment. A fresh process does not make the filesystem immutable or authenticate runtime, launcher or transitive dependency code. The supervisor/runtime/host and selected digests remain trust inputs; the result file cannot prove its own execution.

UNRESOLVED -- concurrent source replacement, loader overrides in uncontrolled environments, complete loaded-code identity, runtime signature trust, full state roots and independent reproduction. Exclusive output creation is not atomic publication or crash-durability proof: an interrupted write can leave a partial file. Consumers must require a successful process exit and independently validate the complete result against retained input/selection, never accept existence alone. Such a result consumer is the next bounded step. No protocol state adoption or production acceptance; the prior 13/66/1241 suites were not rerun.
