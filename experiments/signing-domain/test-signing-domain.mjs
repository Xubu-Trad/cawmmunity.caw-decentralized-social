import assert from 'node:assert/strict';
import fs from 'node:fs';
import {deriveSigningContext as derive} from './signing-domain.mjs';
const vectors=JSON.parse(fs.readFileSync(process.argv[2]));let checks=0;
for(const v of vectors){const r=derive(...v.input);for(const k of ['domain','forkDataRoot','signingRoot'])assert.equal(r[k],v[k]);assert.equal(r.updatesAccepted,false);assert.equal(r.productionAccepted,false);checks++;}
const input=vectors[1].input,base=derive(...input);
for(let i=0;i<4;i++){const changed=[...input];changed[i]=changed[i].slice(0,-2)+(changed[i].endsWith('00')?'01':'00');const r=derive(...changed);assert.notEqual(r.signingRoot,base.signingRoot);if(i===3)assert.equal(r.domain,base.domain);checks++;}
for(const bad of [undefined,null,123,'0x00','0x'+'FF'.repeat(32)]){assert.throws(()=>derive(input[0],input[1],bad,input[3]));checks++;}
assert.throws(()=>derive(...input,'extra'));checks++;
assert.throws(()=>derive('0x'+'00'.repeat(32),...input.slice(1)));checks++;
assert.throws(()=>derive(input[0],'0x1',...input.slice(2)));checks++;
console.log(JSON.stringify({checks,authoredPythonReferenceVectors:vectors.length,externalConsensusVectors:false,updatesAccepted:false,productionAccepted:false}));
