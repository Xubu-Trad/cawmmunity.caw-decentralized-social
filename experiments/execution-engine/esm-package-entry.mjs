import assert from 'node:assert/strict';
import {readFileSync, realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath, pathToFileURL} from 'node:url';

// Deliberately limited to the two existing VM-relative package imports.
export function esmPackageEntry(require, name) {
  assert(['@ethereumjs/tx','@ethereumjs/block'].includes(name));
  const cjs=pathToFileURL(realpathSync(require.resolve(name)));
  assert(cjs.pathname.endsWith('/dist/cjs/index.js'));
  const metadata=JSON.parse(readFileSync(new URL('../../package.json',cjs),'utf8'));
  assert.equal(metadata.name,name); assert.equal(metadata.version,'10.1.3');
  assert.equal(metadata.exports['.'].import.default,'./dist/esm/index.js');
  const esm=new URL('../esm/index.js',cjs);
  assert.equal(realpathSync(fileURLToPath(esm)),fileURLToPath(esm));
  console.log(JSON.stringify({esmEntrypoint:name,sha256:createHash('sha256').update(readFileSync(esm)).digest('hex')}));
  return esm;
}
