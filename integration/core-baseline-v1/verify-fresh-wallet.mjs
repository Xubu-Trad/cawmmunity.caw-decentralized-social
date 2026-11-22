import fs from 'node:fs';import assert from 'node:assert/strict';import {inspectHeaderBoundStateProof} from '../../reference/header-bound-state-proof.mjs';
const e=JSON.parse(fs.readFileSync(process.argv[2])),m=JSON.parse(fs.readFileSync(process.argv[3]));
// This endpoint is selected from the fresh local execution; it is not an authenticated public anchor.
const selection={schema:'caw-header-state-selection/1',profile:'shanghai-17',hash:e.header.hash,address:'0x19a827174f66b3c66ad7063951d7b4f94f996e77',storageKeys:m.storage.map(x=>x.key)};
function verify(x){const r=inspectHeaderBoundStateProof(JSON.stringify(x),JSON.stringify(selection));for(const f of m.storage){const v=r.proof.storage.find(x=>x.key===f.key);assert(v);assert.equal(BigInt(v.value).toString(),f.expected);}assert.equal(r.proof.storage.find(x=>x.key===m.storage.find(x=>x.label==='approved2').key).exists,false);return r;}
verify(e);for(const mutate of [x=>x.header.stateRoot='0x'+'11'.repeat(32),x=>x.header.hash='0x'+'11'.repeat(32),x=>x.proof.storageProof[0].value='0x1',x=>x.proof.storageProof.pop(),x=>x.proof.accountProof[0]='0xc0']){let x=structuredClone(e);mutate(x);assert.throws(()=>verify(x));}
console.log(JSON.stringify({fields:16,negativeControls:5,headerHash:e.header.hash,localEndpointSelected:true,chainAuthenticated:false,finalityVerified:false}));
