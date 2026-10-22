import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { inspectRecoveryBundle, RECOVERY_FILES } from '../reference/recovery-bundle.mjs';
import { checkRecoveryDirectory } from '../scripts/check-recovery-bundle.mjs';
const root = new URL('../experiments/paid-signed-body-acquisition/', import.meta.url);
const sha = x => createHash('sha256').update(x).digest('hex');
const raw = readFileSync(new URL('body-captures.json', root));
assert.equal(sha(raw), 'e2db3326525f1b6b3e24af6582482220c7db1cf8d2e5a1099005caca84ba0c36');
const bytes = gunzipSync(readFileSync(new URL('execution-trace.json.gz', root)), { maxOutputLength: 8388608 });
assert.equal(sha(bytes), '6ca0685230a9917eb3d73ce0a74666c9d4442059883df65f4a374551735c2975');
const captures = JSON.parse(raw), trace = JSON.parse(bytes);
function sample(branch='left') {
  const { history, manifest } = trace.branches[branch].collectors.number;
  const policy = { schema: 'caw-paid-post-policy/1', profile: 'paid-action-v1-eoa-65-low-s',
    assumedEoaOwners: ['0x765d03fe39e2a0a48ac162a15b541c3cd1d63e76', '0x47ecac8221f18970c48cf48aaa3cbe8167bbbe73'] };
  const parts = Object.fromEntries(RECOVERY_FILES.map((f,i) => [f,JSON.stringify([history,manifest,captures.branches[branch],policy][i])]));
  return { parts, selection: { schema: 'caw-recovery-selection/1', profile: 'fixed-registry-eoa/1', chainId: '0x7a69',
    startBlockHash: manifest.start_block_hash, endBlockHash: manifest.end_block_hash,
    sha256: Object.fromEntries(RECOVERY_FILES.map(f=>[f,sha(parts[f])])) } };
}
const run = s => inspectRecoveryBundle(s.parts, JSON.stringify(s.selection));
const reject = (s, code) => assert.throws(()=>run(s),e=>code ? e.code===code : typeof e.code==='string');
for (const branch of ['left','right']) test('recover retained '+branch+' while retaining all trust boundaries',()=>{
  const result=run(sample(branch)); assert.equal(result.reconstructionVerified,true);
  assert.equal(result.checked.post_history.successfulPostCount,branch==='left'?3:2);
  for(const k of ['endpointAuthenticated','acquisitionIndependent','accountAuthorityVerified','executionVerified','finalityVerified','productionAccepted']) assert.equal(result[k],false,k);
  assert.equal(Object.isFrozen(result),true);
});
test('missing body file rejects',()=>{const s=sample();delete s.parts['bodies.json'];reject(s,'RECOVERY_BUNDLE_SCHEMA');});
test('mutated bytes reject before reader execution',()=>{const s=sample();s.parts['history.json']+=' ';reject(s,'RECOVERY_BUNDLE_HASH');});
test('wrong separately retained endpoint rejects',()=>{const s=sample();s.selection.endBlockHash='0x'+'11'.repeat(32);reject(s,'RECOVERY_BUNDLE_ENDPOINT');});
test('unsupported account profile rejects',()=>{const s=sample();s.selection.profile='contract-wallet/1';reject(s,'RECOVERY_BUNDLE_PROFILE');});
test('unsupported chain rejects',()=>{const s=sample();s.selection.chainId='0x1';reject(s,'RECOVERY_BUNDLE_CHAIN');});
test('duplicate selection keys reject',()=>{const s=sample();assert.throws(()=>inspectRecoveryBundle(s.parts,JSON.stringify(s.selection).replace('"chainId":','"chainId":"0x1","chainId":')),e=>e.code.startsWith('BOUNDED_JSON_'));});
test('extra package member rejects',()=>{const s=sample();s.parts['../secret']='x';reject(s,'RECOVERY_BUNDLE_SCHEMA');});
test('accessor input does not execute',()=>{const s=sample();let called=false;Object.defineProperty(s.parts,'bodies.json',{get(){called=true;throw Error('called');},enumerable:true});reject(s,'RECOVERY_BUNDLE_SCHEMA');assert.equal(called,false);});
test('oversized member rejects',()=>{const s=sample();s.parts['bodies.json']='x'.repeat(1048577);reject(s,'RECOVERY_BUNDLE_LIMIT');});
test('matching a new hash cannot conceal missing block evidence',()=>{const s=sample();const b=JSON.parse(s.parts['bodies.json']);b.pop();s.parts['bodies.json']=JSON.stringify(b);s.selection.sha256['bodies.json']=sha(s.parts['bodies.json']);reject(s);});
test('matching hashes do not accept missing owner assumptions',()=>{const s=sample();const p=JSON.parse(s.parts['policy.json']);p.assumedEoaOwners=[];s.parts['policy.json']=JSON.stringify(p);s.selection.sha256['policy.json']=sha(s.parts['policy.json']);reject(s,'PAID_POST_SIGNATURE_OWNER_ASSUMPTION');});
test('directory checker recovers from fresh files and rejects missing or oversized files',()=>{
  const s=sample(), dir=mkdtempSync(join(tmpdir(),'caw-recovery-')), bundle=join(dir,'bundle');mkdirSync(bundle);
  for(const f of RECOVERY_FILES)writeFileSync(join(bundle,f),s.parts[f]);
  const selected=join(dir,'selection.json');writeFileSync(selected,JSON.stringify(s.selection));
  const good=checkRecoveryDirectory(bundle,selected);assert.equal(good.endpointAuthenticated,false);
  assert.throws(()=>checkRecoveryDirectory(join(dir,'absent'),selected),e=>e.code==='ENOENT');
  const large=join(dir,'oversized');mkdirSync(large);writeFileSync(join(large,'history.json'),'x'.repeat(1048577));
  assert.throws(()=>checkRecoveryDirectory(large,selected),/FILE_LIMIT/);
  // The caller/supervisor retains this disposable evidence directory; no recursive deletion.
});
