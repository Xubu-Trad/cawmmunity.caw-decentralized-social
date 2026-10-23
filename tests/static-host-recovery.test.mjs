import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { collectStatic } from '../scripts/build.mjs';
import { checkStaticDirectory } from '../scripts/check-static-dist.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const mime = name => name.endsWith('.html') ? 'text/html' : name.endsWith('.mjs') ? 'text/javascript'
  : name.endsWith('.css') ? 'text/css' : name.endsWith('.json') ? 'application/json'
  : name.endsWith('.png') ? 'image/png' : 'text/plain';

async function recoveredHost(t, mutate = false) {
  const entries = await collectStatic(), root = await mkdtemp(join(tmpdir(), 'caw-host-recovery-'));
  for (const entry of entries) await writeFile(join(root, entry.name), entry.bytes);
  const pin = entries.at(-1).sha256;
  assert.equal(checkStaticDirectory(root, pin).assetHashesMatched, true);
  const names = new Set(entries.map(e => e.name));
  // A separate test host: no import of server.mjs, original public-directory
  // routes, application database, credentials or network services.
  const server = http.createServer(async (req, res) => {
    const name = req.url.startsWith('/restored/') ? req.url.slice('/restored/'.length) : '';
    if (req.method !== 'GET' || !names.has(name)) { res.writeHead(404); res.end(); return; }
    try {
      const bytes = await readFile(join(root, name));
      res.writeHead(200, { 'Content-Type': mime(name), 'Cache-Control': 'no-store' });
      res.end(mutate && name === 'app.mjs' ? Buffer.from('changed by host') : bytes);
    } catch { res.writeHead(500); res.end(); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  return { entries, pin, server };
}
function get(server, path) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port: server.address().port, path, agent: false }, res => {
      const chunks = []; let size = 0;
      res.on('data', chunk => { size += chunk.length; if (size > 2 * 1024 * 1024) res.destroy(new Error('response bound')); else chunks.push(chunk); });
      res.on('error', reject); res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'], bytes: Buffer.concat(chunks) }));
    });
    req.setTimeout(2000, () => req.destroy(new Error('response timeout'))); req.on('error', reject);
  });
}
async function checkResponses(host) {
  const m = await get(host.server, '/restored/SHA256SUMS.txt');
  assert.equal(m.status, 200); assert.equal(hash(m.bytes), host.pin);
  for (const entry of host.entries) {
    const response = await get(host.server, '/restored/' + entry.name);
    assert.equal(response.status, 200); assert.equal(response.type, mime(entry.name));
    assert.equal(hash(response.bytes), entry.sha256, 'served hash: ' + entry.name);
  }
}
test('replacement host serves every copied release byte under a relocated prefix', async t => {
  const host = await recoveredHost(t); await checkResponses(host);
  for (const file of ['index.html', 'website.html']) {
    const response = await get(host.server, '/restored/' + file), html = response.bytes.toString('utf8');
    assert.match(html, /ALPHA \/ SIMULATION/);
    for (const match of html.matchAll(/(?:src|href)="\.\/([^"#]+)(?:#[^"]*)?"/g)) {
      const url = new URL(match[0].split('"')[1], 'http://127.0.0.1/restored/' + file);
      assert.ok(url.pathname.startsWith('/restored/'));
      assert.equal((await get(host.server, url.pathname)).status, 200);
    }
  }
});
test('good local build and checksum cannot conceal corrupted hosted script', async t => {
  const host = await recoveredHost(t, true);
  await assert.rejects(checkResponses(host), /served hash: app.mjs/);
});
test('replacement fixture host exposes neither source paths nor traversal', async t => {
  const host = await recoveredHost(t);
  for (const path of ['/app.mjs', '/restored/../package.json', '/restored/%2e%2e/package.json', '/restored/server.mjs', '/restored/.env']) {
    assert.equal((await get(host.server, path)).status, 404);
  }
});
