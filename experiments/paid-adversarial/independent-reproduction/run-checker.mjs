#!/usr/bin/env node
// Re-run the repository's offline checker (validateEvidence) against an
// independent execution trace for the alpha.21 adversarial regression
// (Xubu-Trad/cawmmunity.caw-decentralized-social, Issue #2).
//
// The checker recomputes the accounting of a single trace without
// executing an EVM. It does not authenticate a chain and does not
// re-execute the contract (its own result says so).
//
// Usage:
//   node run-checker.mjs --repo <repo-clone> --trace <independent-trace.json>
//                        [--experiment-dir <dir-with-input-files>]
//
//   --repo           A clone of cawmmunity.caw-decentralized-social at
//                    commit 85627137cda2e79390f57dc6e05c7ceb7809e049.
//                    The checker is imported from
//                    <repo>/reference/paid-adversarial-evidence.mjs.
//   --trace          The execution trace to validate (for this package:
//                    independent-run.json).
//   --experiment-dir Directory holding the input files named by the
//                    trace's `inputs` manifest. Defaults to
//                    <repo>/experiments/paid-adversarial.
//
// Output: the checker's validation result as JSON on stdout.
// Exit code: 0 when the checker accepts the trace, 1 when it rejects it
// or on any usage/IO error. Node.js builtins only; no dependencies.

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function arg(name, required = false) {
  const i = process.argv.indexOf(name);
  if (i === -1 || i + 1 >= process.argv.length) {
    if (required) {
      console.error(`missing required argument: ${name}`);
      process.exit(1);
    }
    return null;
  }
  return process.argv[i + 1];
}

const repo = arg('--repo', true);
const tracePath = arg('--trace', true);
const experimentDir =
  arg('--experiment-dir') ??
  path.join(repo, 'experiments', 'paid-adversarial');

const checkerPath = path.join(repo, 'reference', 'paid-adversarial-evidence.mjs');
if (!fs.existsSync(checkerPath)) {
  console.error(`checker not found: ${checkerPath}`);
  process.exit(1);
}

let evidence;
try {
  evidence = JSON.parse(fs.readFileSync(tracePath, 'utf8'));
} catch (e) {
  console.error(`cannot read trace ${tracePath}: ${e.message}`);
  process.exit(1);
}

const inputBytes = new Map();
try {
  for (const name of Object.keys(evidence.inputs)) {
    inputBytes.set(name, fs.readFileSync(path.join(experimentDir, name)));
  }
} catch (e) {
  console.error(`cannot read input files from ${experimentDir}: ${e.message}`);
  process.exit(1);
}

const { validateEvidence } = await import(pathToFileURL(checkerPath).href);
try {
  const result = validateEvidence(evidence, { inputBytes });
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
} catch (e) {
  console.error(`CHECKER REJECTED: ${e.message}`);
  process.exit(1);
}
