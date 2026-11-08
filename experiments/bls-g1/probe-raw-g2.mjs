// Characterize the pinned raw decoder separately from the canonical adapter.
import {readFileSync} from 'node:fs';
import {bls12_381} from '@noble/curves/bls12-381';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url));
const inventory=JSON.parse(read('evidence/bls-signatures-20261107/vector-inventory.json'));
const observations=[];
for(const item of inventory.filter(x=>x.archivePath.startsWith('./deserialization_G2/'))) {
  const vector=JSON.parse(read(item.path));
  const bytes=Buffer.from(vector.input.signature.replace(/^0x/,''),'hex');
  let actual=false;
  try {bls12_381.G2.ProjectivePoint.fromHex(bytes).assertValidity();actual=true;} catch {}
  observations.push({case:item.archivePath,expected:vector.output,rawDecoderAccepted:actual,match:actual===vector.output});
}
console.log(JSON.stringify({schema:'caw-raw-g2-observation/1',cases:observations.length,
  matches:observations.filter(x=>x.match).length,observations},null,2));
