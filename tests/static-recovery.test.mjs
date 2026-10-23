import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, unlink, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { collectStatic } from '../scripts/build.mjs';
import { checkStaticDirectory } from '../scripts/check-static-dist.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'caw-static-'));
  const entries = await collectStatic();
  for (const e of entries) await writeFile(join(root, e.name), e.bytes);
  return { root, manifest: entries.at(-1).bytes, pin: entries.at(-1).sha256 };
}
function rejects(root, pin, code) { assert.throws(() => checkStaticDirectory(root, pin), { code: 'STATIC_RECOVERY_' + code }); }

test('copied build verifies exact bytes and retains all trust limits', async () => {
  const {root,pin} = await fixture();
  const a = checkStaticDirectory(root,pin), b = checkStaticDirectory(root,pin);
  assert.deepEqual(a,b); assert.equal(a.files,23); assert.equal(a.assetHashesMatched,true);
  for (const key of ['originAuthenticated','hostedContentVerified','protocolVerified','productionAccepted']) assert.equal(a[key],false);
  assert.ok(Object.isFrozen(a));
});
test('missing file rejects', async () => { const f=await fixture(); await unlink(join(f.root,'index.html')); rejects(f.root,f.pin,'ENTRY_SET'); });
test('extra executable rejects without executing it', async () => { const f=await fixture(); await writeFile(join(f.root,'extra.mjs'),'throw new Error("must not run")'); rejects(f.root,f.pin,'ENTRY_SET'); });
test('changed asset rejects', async () => { const f=await fixture(); await writeFile(join(f.root,'app.mjs'),'changed'); rejects(f.root,f.pin,'ASSET_HASH'); });
test('replacement manifest and asset cannot satisfy original pin', async () => {
  const f=await fixture(); await writeFile(join(f.root,'index.html'),'replacement');
  const changed=f.manifest.toString().replace(/^[0-9a-f]{64}/,sha('replacement'));
  await writeFile(join(f.root,'SHA256SUMS.txt'),changed); rejects(f.root,f.pin,'PIN_MISMATCH');
  const selfPinned=checkStaticDirectory(f.root,sha(changed));
  assert.equal(selfPinned.originAuthenticated,false); assert.equal(selfPinned.productionAccepted,false);
});
test('missing malformed and wrong pins reject', async () => {
  const f=await fixture();
  rejects(f.root,undefined,'PIN'); rejects(f.root,f.pin.toUpperCase(),'PIN'); rejects(f.root,'0'.repeat(64),'PIN_MISMATCH');
  assert.throws(()=>checkStaticDirectory(f.root),{code:'STATIC_RECOVERY_ARGUMENTS'});
});
test('pinned traversal name rejects without reading outside directory', async () => {
  const f=await fixture(); const m=f.manifest.toString().replace('  index.html','  ../outside');
  await writeFile(join(f.root,'SHA256SUMS.txt'),m); rejects(f.root,sha(m),'MANIFEST');
});
test('pinned duplicate manifest name rejects', async () => {
  const f=await fixture(); const m=f.manifest.toString().replace('  website.html','  index.html');
  await writeFile(join(f.root,'SHA256SUMS.txt'),m); rejects(f.root,sha(m),'MANIFEST');
});
test('pinned noncanonical line endings reject', async () => {
  const f=await fixture(); const m=f.manifest.toString().replaceAll('\n','\r\n');
  await writeFile(join(f.root,'SHA256SUMS.txt'),m); rejects(f.root,sha(m),'MANIFEST');
});
test('asset directory rejects as nonregular', async () => {
  const f=await fixture(); await unlink(join(f.root,'app.mjs')); await mkdir(join(f.root,'app.mjs')); rejects(f.root,f.pin,'REGULAR_FILE');
});
test('oversized asset rejects even with matching self-chosen manifest', async () => {
  const f=await fixture(); const b=Buffer.alloc(1048577);
  await writeFile(join(f.root,'index.html'),b);
  const m=f.manifest.toString().replace(/^[0-9a-f]{64}/,sha(b)); await writeFile(join(f.root,'SHA256SUMS.txt'),m);
  rejects(f.root,sha(m),'SIZE');
});
test('oversized manifest rejects before parsing', async () => {
  const f=await fixture();const m=Buffer.alloc(4097);await writeFile(join(f.root,'SHA256SUMS.txt'),m);rejects(f.root,sha(m),'SIZE');
});
