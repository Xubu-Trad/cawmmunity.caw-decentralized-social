import assert from 'node:assert/strict';
import {readFileSync, realpathSync, statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {dirname, resolve, relative, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

// Bounded observations of default Node conditions, not a full loader attestation.
const root=dirname(fileURLToPath(import.meta.url));
const require=createRequire(import.meta.url);
const hash=b=>createHash('sha256').update(b).digest('hex');
assert.equal(hash(readFileSync(resolve(root,'pnpm-lock.yaml'))),'fae68803a13e3cfa804cb872ca4872f65e844adb21c9d844fa5fb6804d0e6773');
function identify(name, mode, resolved) {
  const base=realpathSync(resolve(root,'node_modules/.pnpm',name.replace('/','+')+'@10.1.3','node_modules',name));
  const p=realpathSync(resolved);
  const rel=relative(base,p);
  assert(!rel.startsWith('..') && !rel.startsWith(sep),'entrypoint escapes package');
  assert.equal(rel.split(sep).join('/'),`dist/${mode}/index.js`);
  assert(statSync(p).size<=1024*1024);
  const metadata=readFileSync(resolve(base,'package.json'));
  const pkg=JSON.parse(metadata);
  assert.equal(pkg.name,name); assert.equal(pkg.version,'10.1.3');
  assert.equal(pkg.exports['.'][mode==='esm'?'import':'require'].default,`./dist/${mode}/index.js`);
  return {name,version:pkg.version,mode,path:rel.split(sep).join('/'),sha256:hash(readFileSync(p)),packageJsonSha256:hash(metadata)};
}
const entries=[];
for(const name of ['@ethereumjs/common','@ethereumjs/evm','@ethereumjs/statemanager','@ethereumjs/util','@ethereumjs/vm']) {
  entries.push(identify(name,'esm',fileURLToPath(import.meta.resolve(name))));
  entries.push(identify(name,'cjs',require.resolve(name)));
}
const vmRequire=createRequire(require.resolve('@ethereumjs/vm'));
for(const name of ['@ethereumjs/tx','@ethereumjs/block']) entries.push(identify(name,'cjs',vmRequire.resolve(name)));
const esm=await import('@ethereumjs/util');
const cjs=require('@ethereumjs/util');
const addressText='0x765d03fe39e2a0a48ac162a15b541c3cd1d63e76';
const a=esm.createAddressFromString(addressText),b=cjs.createAddressFromString(addressText);
assert.notEqual(esm.Address,cjs.Address);
assert(!(b instanceof esm.Address));
assert.equal(a.toString(),b.toString());
assert.deepEqual([...a.bytes],[...b.bytes]);
console.log(JSON.stringify({schema:'caw-entrypoint-observation/1',entries,entrypointsChecked:entries.length,
  addressProbe:{distinctConstructors:true,crossModeInstanceof:false,sameAddressBytes:true},
  scope:'five direct package roots in default import/require modes plus two VM-relative require paths',
  fullDependencyGraphVerified:false,loadedModulesAttested:false,releaseSignatureVerified:false,productionAccepted:false},null,2));
