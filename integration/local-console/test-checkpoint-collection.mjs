import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';
import { inspectExecutionHeaderChain } from '../../reference/ethereum-execution-header.mjs';
import { makeWithdrawalProofPackage } from './withdrawal-proof-package.mjs';

const cli = fileURLToPath(new URL('./collect-checkpoint-headers.mjs', import.meta.url));
const fixture = JSON.parse(readFileSync(new URL('../../evidence/console-withdrawal-20261116/withdrawal-boundaries.json', import.meta.url)));
const { before, after } = fixture;
const pins = { schema: 'caw-execution-header-chain-selection/1', profile: 'shanghai-17',
  startHash: before.header.hash, endHash: after.header.hash };

for (const mode of ['valid', 'missing parent', 'wrong block', 'changed root', 'wrong response ID']) {
  test(mode, async t => {
    const requests = [];
    const server = http.createServer(async (req, res) => {
      let body = '';
      for await (const chunk of req) body += chunk;
      const { method, id, params } = JSON.parse(body);
      requests.push([method, ...params]);
      let result = params[0] === pins.endHash ? after.header : before.header;
      if (id === 2 && mode === 'missing parent') result = null;
      if (id === 2 && mode === 'wrong block') result = after.header;
      if (id === 2 && mode === 'changed root') result = { ...result, stateRoot: '0x' + '00'.repeat(32) };
      res.end(JSON.stringify({ jsonrpc: '2.0', id: mode === 'wrong response ID' ? id + 1 : id, result }));
    });
    await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    const args = [cli, 'http://127.0.0.1:' + server.address().port, pins.startHash, pins.endHash];
    const run = promisify(execFile)(process.execPath, args, { windowsHide: true, timeout: 15000 });
    if (mode !== 'valid') {
      await assert.rejects(run, error => error.code === 1 && error.stdout === '' &&
        /Requested block unavailable|HASH_MISMATCH/.test(error.stderr));
      return;
    }
    const { stdout } = await run;
    assert.deepEqual(requests, [pins.endHash, pins.startHash].map(hash => ['eth_getBlockByHash', hash, false]));
    assert.equal(inspectExecutionHeaderChain(JSON.parse(stdout), pins).endHash, pins.endHash);
    const directory = mkdtempSync(join(tmpdir(), 'caw-header-collection-'));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const headerFile = join(directory, 'headers.json');
    writeFileSync(headerFile, stdout);
    const pathFor = name => fileURLToPath(new URL(name, import.meta.url));
    const evidence = '../../evidence/console-withdrawal-20261116/';
    const selectionPath = pathFor(evidence + 'withdrawal-selection.json');
    const proofFile = join(directory, 'withdrawal-proofs.json');
    writeFileSync(proofFile, JSON.stringify(makeWithdrawalProofPackage(fixture, JSON.parse(readFileSync(selectionPath)))));
    const result = await promisify(execFile)(process.execPath, [pathFor('./verify-withdrawal-package.mjs'),
      proofFile, selectionPath, headerFile, pins.endHash], { windowsHide: true, timeout: 30000 });
    assert.equal(JSON.parse(result.stdout).checkpoint.withdrawalAncestryVerified, true);
  });
}
