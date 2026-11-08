import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {keccak256} from 'ethers';
import {inventory} from './inventory.mjs';

// Historical service capture, not a current RPC observation or account proof.
const input=fs.readFileSync(process.argv[2]);
assert.equal(createHash('sha256').update(input).digest('hex'),'e329b9a5fe9b53bea5eea3a1612b211a60b4ff1c0fa66a4100b895b5552ca691','CAPTURE_PIN');
const data=JSON.parse(input),runtime=data.runtimeBytecode;
assert.equal(String(data.chainId),'1');
assert.equal(data.address.toLowerCase(),'0xf3b9569f82b18aef890de263b84189bd33ebe452');
assert.equal(data.runtimeMatch,'match');
const expected={chainId:'1',blockNumber:'25936362',blockHash:'0xf3e3dfad2242562dbed62de90831c39eace7c7c6e88f8c509afccef9a5f73e4d',address:data.address.toLowerCase(),codeHash:'0x6ee560d3e6b1f881a8711e0be0b30a0e8e0cf8b915ce8f75ea05002126c94256'};
const result=inventory({...expected,code:runtime.onchainBytecode},expected);
assert.equal(result.bytes,2278);
const actual=Buffer.from(runtime.onchainBytecode.slice(2),'hex');
const compiled=Buffer.from(runtime.recompiledBytecode.slice(2),'hex');
assert.equal(compiled.length,actual.length);
const differences=[...actual.keys()].filter(i=>actual[i]!==compiled[i]);
assert.deepEqual(differences,[314,...Array.from({length:32},(_,i)=>2235+i)]);
// The saved service compilation has declared immutable/metadata substitutions.
// Confirm them without claiming that a compiler was independently executed here.
assert.deepEqual(runtime.immutableReferences,{'669':[{start:283,length:32}]});
assert.equal(runtime.transformationValues.immutables['669'],'0x'+'0'.repeat(62)+'12');
assert.equal(runtime.cborAuxdata['1'].offset,2225);
const adjusted=Buffer.from(compiled);
Buffer.from(runtime.transformationValues.immutables['669'].slice(2),'hex').copy(adjusted,283);
const metadata=Buffer.from(runtime.transformationValues.cborAuxdata['1'].slice(2),'hex');
assert.equal(metadata.length,53);metadata.copy(adjusted,2225);
assert.deepEqual(adjusted,actual);
const names=data.abi.filter(x=>x.type==='function').map(x=>x.name).sort();
assert.deepEqual(names,['allowance','approve','balanceOf','decimals','decreaseAllowance','increaseAllowance','name','symbol','totalSupply','transfer','transferFrom']);
const source=data.stdJsonInput.sources['StandardERC20.sol'].content;
assert.equal(keccak256(Buffer.from(source)),'0xecb60d357ab18ecefb17b11d354cc9df3a83f6cea76a1e00ef2fc0dee510c4e8');
const report={
 schema:'caw-retained-asset-review/1',captureSha256:createHash('sha256').update(input).digest('hex'),
 captureDate:'2026-09-09',historicalContext:expected,contextAuthenticated:false,
 runtimeBytes:actual.length,runtimeKeccak:keccak256(actual),sourceKeccak:keccak256(Buffer.from(source)),
 abiFunctions:names,linearFlags:result.flags,
 flagsBeforeServiceDeclaredMetadata:result.flags.filter(f=>f.offset<2225),
 metadataStart:2225,serviceReportedProxyResolution:data.proxyResolution,
 serviceCompiledDifferenceOffsets:differences,declaredTransformationsReproduceRuntime:true,
 exactOriginalMetadataMatch:false,compilerRerun:false,accountProofVerified:false,
 currentChainStateVerified:false,productionAccepted:false,
 limitations:'Pinned historical service bytes only. ABI and opcode scan are corroboration, not proof of all authority paths. Service metadata boundary and proxy classification are attributed. Original metadata and authenticated current account/code evidence remain outstanding; C-001 is unresolved.'
};
console.log(JSON.stringify(report,null,2));
