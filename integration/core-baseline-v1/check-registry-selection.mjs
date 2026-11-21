import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import solc from 'solc';import {Transaction,AbiCoder,getCreateAddress,keccak256} from 'ethers';
const [manifestPath,expectedDigest,inputPath,operationsPath]=process.argv.slice(2);
const digest=b=>createHash('sha256').update(b).digest('hex');
const manifestBytes=fs.readFileSync(manifestPath);assert.equal(digest(manifestBytes),expectedDigest,'MANIFEST_SELECTION');
const manifest=JSON.parse(manifestBytes),rawInput=fs.readFileSync(inputPath);
assert.equal(digest(rawInput),manifest.compilerInputSha256,'COMPILER_INPUT');
assert.equal(solc.version(),manifest.compiler,'COMPILER');
const input=JSON.parse(rawInput);input.settings.outputSelection={'*':{'*':['evm.bytecode.object','evm.deployedBytecode.object']}};
const output=JSON.parse(solc.compile(JSON.stringify(input)));assert(!(output.errors??[]).some(x=>x.severity==='error'));
const registry=output.contracts[manifest.sourceKey][manifest.contract];
const expectedInit='0x'+registry.evm.bytecode.object+AbiCoder.defaultAbiCoder().encode(['address','address'],manifest.initialOwners).slice(2);
const runtimeHash=keccak256('0x'+registry.evm.deployedBytecode.object);
assert.equal(runtimeHash,manifest.runtimeHash,'RUNTIME_SELECTION');
function check(row){
 const tx=Transaction.from(row.rawTransaction);assert.equal(tx.hash,row.hash,'HASH');assert.equal(tx.hash,manifest.deploymentHash,'DEPLOYMENT_SELECTION');
 assert.equal(tx.chainId.toString(),manifest.chainId,'CHAIN');assert.equal(tx.from?.toLowerCase(),manifest.deployer.toLowerCase(),'SIGNER');
 assert.equal(tx.nonce,manifest.deploymentNonce,'NONCE');assert.equal(tx.to,null,'CREATE');assert.equal(tx.value,0n,'VALUE');assert.equal(tx.data,expectedInit,'INITIALIZATION');
 assert.equal(getCreateAddress({from:tx.from,nonce:tx.nonce}).toLowerCase(),manifest.address.toLowerCase(),'ADDRESS');
 assert.equal(row.status,1,'RECORDED_STATUS');
 return {address:manifest.address,runtimeHash,transactionHash:tx.hash};
}
const operations=JSON.parse(fs.readFileSync(operationsPath));const selected=operations[manifest.operationIndex];assert(selected);
const accepted=check(selected),controls=[];
for(const [name,mutate]of [['hash label',r=>r.hash='0x'+'00'.repeat(32)],['failure label',r=>r.status=0],['different signed deployment',r=>Object.assign(r,operations[2])]]){
 const row=structuredClone(selected);mutate(row);assert.throws(()=>check(row));controls.push(name);
}
console.log(JSON.stringify({status:'PINNED_LOCAL_REGISTRY_SELECTION',accepted,controls,limits:'Manifest is explicitly selected local research configuration, not externally approved authority. Receipt status is supplied observation, not authenticated inclusion. Runtime hash is compiled expectation, not a live code proof. Does not certify registry policy, current state, dependencies or production deployment.'},null,2));
