// Read retained third-party observations using this checkout's own readers.
// No RPC, supplied executable, canonical-chain selection or EVM replay.
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { reconstruct } from '../reference/paid-action-reader.mjs';
import { createPaidHeaderRecovery } from '../reference/paid-header-recovery.mjs';

const directory = process.argv[2];
if (!directory) throw Error('Supply the retained RUN_002 observation directory');
const rows = [], inputs = [];
function check(id, fn) { fn(); rows.push({ id, passed: true }); }
function checked(data) {
  const reader = createPaidHeaderRecovery('london-16');
  const token = reader.select(data.manifest);
  reader.commit(reader.prepare(token, data.history));
  return reader.state();
}
const datasets = {};
for (const label of ['branchA-A', 'branchA-B', 'branchB-A', 'branchB-B', 'older-prefix']) {
  const bytes = readFileSync(join(resolve(directory), label, 'collected.json'));
  assert.ok(bytes.length <= 8 * 1024 * 1024, 'input byte limit');
  inputs.push({ label, sha256: createHash('sha256').update(bytes).digest('hex'), size: bytes.length });
  const data = JSON.parse(bytes); datasets[label] = data;
  check('reconstruct-and-header-check-' + label, () => {
    reconstruct(data.history, data.manifest);
    assert.equal(checked(data).status, 'ready');
  });
}
for (const branch of ['A', 'B']) check('two-collector-equal-history-and-manifest-' + branch, () => {
  const a = datasets['branch' + branch + '-A'], b = datasets['branch' + branch + '-B'];
  // Acquisition metadata legitimately differs by traversal/process. Compare
  // history and selection, not the transport provenance envelope.
  assert.deepEqual(a.history, b.history);
  assert.deepEqual(a.manifest, b.manifest);
});
const original = datasets['branchA-A'];
const multi = original.history.blocks.findIndex(b => b.transactions.length >= 2);
const logged = original.history.blocks.findIndex(b => b.transactions.some(t => t.receipt.logs.length >= 2));
assert.ok(multi >= 0 && logged >= 0, 'required negative-case preconditions');
const mutations = {
  'missing-block': h => h.blocks.splice(2, 1),
  'duplicate-block': h => h.blocks.splice(2, 0, structuredClone(h.blocks[2])),
  'reordered-block': h => [h.blocks[2], h.blocks[3]] = [h.blocks[3], h.blocks[2]],
  'missing-transaction': h => h.blocks[multi].transactions.pop(),
  'duplicate-transaction': h => { const b = h.blocks[multi]; b.transactions.push(structuredClone(b.transactions[0])); b.header.transactions.push(b.header.transactions[0]); },
  'reordered-transaction': h => h.blocks[multi].transactions.reverse(),
  'missing-receipt': h => delete h.blocks[multi].transactions[0].receipt,
  'duplicate-receipt': h => h.blocks[multi].transactions[1].receipt = structuredClone(h.blocks[multi].transactions[0].receipt),
  'reordered-receipt': h => { const a = h.blocks[multi].transactions; [a[0].receipt, a[1].receipt] = [a[1].receipt, a[0].receipt]; },
  'missing-log': h => h.blocks[logged].transactions.find(t => t.receipt.logs.length >= 2).receipt.logs.pop(),
  'duplicate-log': h => { const logs = h.blocks[logged].transactions.find(t => t.receipt.logs.length >= 2).receipt.logs; logs.push(structuredClone(logs[0])); },
  'reordered-log': h => h.blocks[logged].transactions.find(t => t.receipt.logs.length >= 2).receipt.logs.reverse()
};
for (const [name, mutate] of Object.entries(mutations)) check(name, () => {
  const data = structuredClone(original); mutate(data.history);
  assert.throws(() => reconstruct(data.history, data.manifest), e => typeof e.code === 'string');
});
check('conflicting-branch-rejected-under-original-manifest', () => {
  const replacement = datasets['branchB-A'];
  assert.equal(original.history.end_block.number, replacement.history.end_block.number);
  assert.notEqual(original.history.end_block.hash, replacement.history.end_block.hash);
  assert.throws(() => checked({ history: replacement.history, manifest: original.manifest }), e => typeof e.code === 'string');
});
console.log(JSON.stringify({ schema: 'caw-external-history-review/1', inputs, checks: rows,
  scope: 'retained observations; current local readers; no supplied executable',
  freshAcquisition: false, independentProviderVerified: false, endpointAuthenticated: false,
  consensusVerified: false, finalityVerified: false, evmReexecuted: false,
  productionAccepted: false }, null, 2));
