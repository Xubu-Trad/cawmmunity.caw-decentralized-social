import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {deriveForkDataRoot,deriveSigningRoot} from './signing-domain.mjs';
const dir=process.argv[2],manifest=JSON.parse(fs.readFileSync(dir+'/inventory.json'));
assert.equal(manifest.commit,'bc5c1a7fb2a8871aaffd4b16ee4dd9c72bb81908');
assert.equal(manifest.files.length,20);
function load(kind,i,name,keys){
 const relative=`${kind}/case_${i}/${name}`,b=fs.readFileSync(dir+'/vectors/'+relative);
 const path=`tests/mainnet/phase0/ssz_static/${kind}/ssz_random/case_${i}/${name}`;
 const pins=manifest.files.filter(x=>x.path===path);assert.equal(pins.length,1);
 assert.equal(createHash('sha256').update(b).digest('hex'),pins[0].sha256);assert.equal(b.length,pins[0].size);
 const lines=b.toString().trimEnd().split('\n');assert.equal(lines.length,keys.length);const result={};
 lines.forEach((line,n)=>{const m=/^([a-z_]+): '(0x[0-9a-f]+)'$/.exec(line);assert(m);assert.equal(m[1],keys[n]);result[m[1]]=m[2];});return result;
}
const rows=[];let mutations=0;
for(const kind of ['ForkData','SigningData'])for(let i=0;i<5;i++){
 const keys=kind==='ForkData'?['current_version','genesis_validators_root']:['object_root','domain'];
 const v=load(kind,i,'value.yaml',keys),expected=load(kind,i,'roots.yaml',['root']).root;
 const fn=kind==='ForkData'?deriveForkDataRoot:deriveSigningRoot,args=keys.map(k=>v[k]);
 assert.equal(fn(...args),expected);rows.push({kind,case:i,root:expected});
 const altered=[...args];altered[1]=altered[1].slice(0,-2)+(altered[1].endsWith('00')?'01':'00');assert.notEqual(fn(...altered),expected);mutations++;
}
const z='0x'+'00'.repeat(32);
for(const fn of [deriveForkDataRoot,deriveSigningRoot]){
 assert.throws(()=>fn());assert.throws(()=>fn('0x00',z));assert.throws(()=>fn(z,z,'extra'));
}
console.log(JSON.stringify({officialRootMatches:rows.length,mutationControls:mutations,argumentControls:6,rows,sourceCommit:manifest.commit,endToEndConsensusDomainVector:false,signatureVerified:false,productionAccepted:false},null,2));
