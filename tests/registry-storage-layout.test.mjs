import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const base=new URL('../experiments/account-authority/',import.meta.url);
const bytes=name=>readFileSync(new URL(name,base));
const sha=b=>createHash('sha256').update(b).digest('hex');
const record=JSON.parse(bytes('storage-layout.json'));
test('layout receipt remains tied to exact registry source compiler and retained build',()=>{
 const tools=JSON.parse(bytes('toolchain.json')), build=JSON.parse(bytes('authority-build.json'));
 assert.equal(record.source_sha256,sha(bytes('TestAccountRegistry.sol')));
 assert.equal(record.parent_input_sha256,sha(bytes('compile-standard.json')));
 assert.equal(record.compiler_sha256,tools.compiler_sha256);
 assert.equal(record.runtime_sha256,sha(Buffer.from(build.contracts.TestAccountRegistry.runtime.slice(2),'hex')));
 assert.equal(record.runtime_bytes_identical,true);assert.equal(record.creation_bytes_identical,true);assert.equal(record.abi_identical,true);
 assert.equal(record.productionAccepted,false);
});
test('compiler layout records all five expected mapping roots and no packed offsets',()=>{
 const slots=record.storageLayout.storage;
 assert.deepEqual(slots.map(s=>[s.label,s.slot,s.offset]),[
  ['owners','0',0],['balances','1',0],['approved','2',0],['operators','3',0],['epochs','4',0]]);
 const types=record.storageLayout.types;
 for(const slot of slots){assert.equal(types[slot.type].encoding,'mapping');assert.equal(types[slot.type].numberOfBytes,'32');}
 const owners=types[slots[0].type];assert.equal(types[owners.key].label,'uint256');assert.equal(types[owners.value].label,'address');
 const operators=types[slots[3].type];assert.equal(types[operators.key].label,'address');assert.equal(types[operators.value].encoding,'mapping');
 assert.equal(types[types[operators.value].value].label,'bool');
});
