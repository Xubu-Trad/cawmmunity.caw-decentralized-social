import fs from 'node:fs';import assert from 'node:assert/strict';import solc from 'solc';
import {Wallet,Interface,AbiCoder,version,keccak256} from 'ethers';
import {createVM,runTx} from '@ethereumjs/vm';import {createTxFromRLP} from '@ethereumjs/tx';import {createBlock} from '@ethereumjs/block';
import {MerkleStateManager} from '@ethereumjs/statemanager';import {createCustomCommon,Mainnet,Hardfork} from '@ethereumjs/common';import {Account,createAddressFromString} from '@ethereumjs/util';
import {bindCandidateAdmission} from './c007-admission-binding.mjs';
const [sourcePath,out,vectorsPath,proofPath]=process.argv.slice(2);assert(!fs.existsSync(out));fs.mkdirSync(out);
assert.equal(version,'6.16.0');assert.equal(solc.version(),'0.8.30+commit.73712a01.Emscripten.clang');
const input={language:'Solidity',sources:{'FundedAdmissionResearch.sol':{content:fs.readFileSync(sourcePath,'utf8')}},settings:{optimizer:{enabled:true,runs:200},evmVersion:'shanghai',outputSelection:{'*':{'*':['abi','evm.bytecode.object']}}}};
const compiled=JSON.parse(solc.compile(JSON.stringify(input)));assert(!(compiled.errors??[]).some(x=>x.severity==='error'),JSON.stringify(compiled.errors));const contracts=compiled.contracts['FundedAdmissionResearch.sol'];
const bytes=h=>Uint8Array.from(Buffer.from(h.slice(2),'hex')),hex=b=>'0x'+Buffer.from(b).toString('hex');
const payer=new Wallet('0x'+'0'.repeat(63)+'3'),outsider=new Wallet('0x'+'0'.repeat(63)+'4');
const common=createCustomCommon({chainId:31337},Mainnet,{hardfork:Hardfork.Shanghai}),stateManager=new MerkleStateManager();
for(const w of [payer,outsider])await stateManager.putAccount(createAddressFromString(w.address),new Account(0n,10n**20n));
const vm=await createVM({common,stateManager}),block=createBlock({header:{number:1n,gasLimit:30000000n,baseFeePerGas:1n,timestamp:1n,difficulty:0n},withdrawals:[]},{common});const operations=[];
async function send(data,to,status=1,w=payer){
 const nonce=(await stateManager.getAccount(createAddressFromString(w.address))).nonce;
 const raw=await w.signTransaction({type:2,chainId:31337,nonce:Number(nonce),gasLimit:5000000,maxFeePerGas:2,maxPriorityFeePerGas:1,value:0,data,...(to?{to}:{})});
 const tx=createTxFromRLP(bytes(raw),{common});assert(tx.verifySignature());const x=await runTx(vm,{tx,block});assert.equal(x.receipt.status,status);
 const logs=(x.execResult.logs??[]).map(([a,t,d])=>({address:hex(a),topics:t.map(hex),data:hex(d)}));if(status===0)assert.equal(logs.length,0);
 operations.push({hash:hex(tx.hash()),rawTransaction:raw,status,gasUsed:x.totalGasSpent.toString(),logs});return x;
}
const token=(await send('0x'+contracts.AdmissionTokenFixture.evm.bytecode.object)).createdAddress;assert(token);
const ta=new Interface(contracts.AdmissionTokenFixture.abi),fa=new Interface(contracts.FundedAdmissionResearch.abi),vector=JSON.parse(fs.readFileSync(vectorsPath)).vectors[0];
const registryAbi=new Interface(contracts.TestAccountRegistry.abi);
const registryAddress=(await send('0x'+contracts.TestAccountRegistry.evm.bytecode.object+registryAbi.encodeDeploy([payer.address,payer.address]).slice(2))).createdAddress;assert(registryAddress);
const registryHash=keccak256(hex(await stateManager.getCode(registryAddress)));
const funded=(await send('0x'+contracts.FundedAdmissionResearch.evm.bytecode.object+fa.encodeDeploy([token.toString(),payer.address,vector.stakeRoot,registryAddress.toString(),registryHash]).slice(2))).createdAddress;assert(funded);
async function read(addr,abi,name,args=[]){
 const before=hex(await stateManager.getStateRoot());await stateManager.checkpoint();
 try{const x=await vm.evm.runCall({to:addr,caller:createAddressFromString(payer.address),data:bytes(abi.encodeFunctionData(name,args)),gasLimit:200000n,isStatic:true});assert(!x.execResult.exceptionError);return abi.decodeFunctionResult(name,hex(x.execResult.returnValue))[0];}
 finally{await stateManager.revert();assert.equal(hex(await stateManager.getStateRoot()),before);}
}
async function snapshot(){
 const next=await read(funded,fa,'nextNonce'),id=await read(funded,fa,'recordIdFor',[next]);
 return {payer:await read(token,ta,'balanceOf',[payer.address]),vault:await read(token,ta,'balanceOf',[funded.toString()]),allowance:await read(token,ta,'allowance',[payer.address,funded.toString()]),nonce:next,liability:await read(funded,fa,'unpaidLiability'),nextBudget:await read(funded,fa,'budgets',[id])};
}

const proofs=JSON.parse(fs.readFileSync(proofPath));const cases=[];
async function snap(){const x=await snapshot();x.credit=await read(funded,fa,'credits',[2]);x.owner=await read(funded,fa,'owners',[2]);x.epoch=await read(funded,fa,'epochs',[2]);x.other=await read(token,ta,'balanceOf',[outsider.address]);x.credited=await read(funded,fa,'creditedLiability');x.unallocated=await read(funded,fa,'unallocatedBudget');x.approved=await read(registryAddress,registryAbi,'getApproved',[2]);x.ownerBalance=await read(registryAddress,registryAbi,'balanceOf',[outsider.address]);return x;}
async function reject(name,args,reason,w){const before=await snap();const x=await send(fa.encodeFunctionData('withdraw',args),funded.toString(),0,w);const data=hex(x.execResult.returnValue);assert.equal(data.slice(0,10),'0x08c379a0');assert.equal(AbiCoder.defaultAbiCoder().decode(['string'],'0x'+data.slice(10))[0],reason);assert.deepEqual(await snap(),before);cases.push(name);}
async function claim(n){const p=proofs.accounts[1],v=proofs.accounts[2];await send(fa.encodeFunctionData('claim',[n,2,3,v.hashes,v.sums,p.hashes,p.sums]),funded.toString(),1,outsider);}
await send(ta.encodeFunctionData('approve',[funded.toString(),100]),token.toString());
for(const n of [0,1])await send(fa.encodeFunctionData('admit',[n]),funded.toString());
await claim(0);
await send(registryAbi.encodeFunctionData('approve',[outsider.address,2]),registryAddress.toString());
await reject('approved transfer operator cannot withdraw',[2,0,1],'OWNER',outsider);
await send(registryAbi.encodeFunctionData('transferFrom',[payer.address,outsider.address,2]),registryAddress.toString(),1,outsider);
assert.equal(await read(registryAddress,registryAbi,'getApproved',[2]),'0x'+'00'.repeat(20));
await claim(1);await reject('former owner',[2,0,1],'OWNER',payer);await reject('stale new-owner epoch',[2,0,1],'EPOCH',outsider);
// Give the mock token actual transfer permission, so its callback can mutate
// the separate registry despite the custody entry lock.
await send(registryAbi.encodeFunctionData('setApprovalForAll',[token.toString(),true]),registryAddress.toString(),1,outsider);
await send(ta.encodeFunctionData('setCallback',[registryAddress.toString(),registryAbi.encodeFunctionData('transferFrom',[outsider.address,payer.address,2])]),token.toString());
await reject('external registry transfer rolls back withdrawal',[2,1,2],'AUTHORITY_CHANGED',outsider);
assert.equal(await read(token,ta,'callbackCount'),0n);
// Final owner remains B here, but a self-transfer advances the registry epoch.
await send(ta.encodeFunctionData('setCallback',[registryAddress.toString(),registryAbi.encodeFunctionData('transferFrom',[outsider.address,outsider.address,2])]),token.toString());
await reject('same-owner epoch change rolls back withdrawal',[2,1,2],'AUTHORITY_CHANGED',outsider);
assert.equal(await read(token,ta,'callbackCount'),0n);
const hook=(await send('0x'+contracts.RegistryHookResearch.evm.bytecode.object)).createdAddress;assert(hook);
const ha=new Interface(contracts.RegistryHookResearch.abi);
await send(registryAbi.encodeFunctionData('setApprovalForAll',[hook.toString(),true]),registryAddress.toString(),1,outsider);
await send(ta.encodeFunctionData('setCallback',[hook.toString(),ha.encodeFunctionData('cycle',[registryAddress.toString(),outsider.address,2])]),token.toString());
await reject('full B-to-helper-to-B callback rolls back withdrawal',[2,1,2],'AUTHORITY_CHANGED',outsider);
assert.equal(await read(token,ta,'callbackCount'),0n);
await send(ta.encodeFunctionData('setCallback',['0x'+'00'.repeat(20),'0x']),token.toString());
const beforeReceiver=await snap();
const refused=await send(registryAbi.encodeFunctionData('safeTransferFrom(address,address,uint256)',[outsider.address,hook.toString(),2]),registryAddress.toString(),0,outsider);
assert.equal(hex(refused.execResult.returnValue),registryAbi.getError('UnsafeRecipient').selector);
assert.deepEqual(await snap(),beforeReceiver);assert.equal(await read(registryAddress,registryAbi,'balanceOf',[hook.toString()]),0n);
cases.push('unsafe receiver rolls back ownership');
await send(ha.encodeFunctionData('setForward',[true]),hook.toString());
await send(registryAbi.encodeFunctionData('safeTransferFrom(address,address,uint256)',[outsider.address,hook.toString(),2]),registryAddress.toString(),1,outsider);
assert.equal(await read(funded,fa,'owners',[2]),outsider.address);assert.equal(await read(funded,fa,'epochs',[2]),3n);
assert.equal(await read(registryAddress,registryAbi,'balanceOf',[hook.toString()]),0n);
await reject('forwarded safe transfer invalidates old withdrawal epoch',[2,1,2],'EPOCH',outsider);

await send(fa.encodeFunctionData('withdraw',[2,3,2]),funded.toString(),1,outsider);
const final=await snap();assert.equal(final.vault,8n);assert.equal(final.liability,8n);assert.equal(final.credit,0n);assert.equal(final.epoch,3n);assert.equal(final.owner,outsider.address);assert.equal(final.other,2n);assert.equal(final.payer,90n);
const report={status:'REGISTRY_BOUND_RESEARCH_ONLY',transactions:operations.length,rejected:cases,final:JSON.parse(JSON.stringify(final,(_,v)=>typeof v==='bigint'?v.toString():v)),limits:'Derived constructor-only registry with account4, compiler0.8.30; no registration or live authority proof. Single engine; safe receiver rejection/forwarding and full ABA token callback exercised; no independent reconstruction or second-engine comparison.'};
for(const [name,value]of Object.entries({'compiler-input.json':input,'operations.json':operations,'result.json':report}))fs.writeFileSync(out+'/'+name,JSON.stringify(value,null,2)+'\n');
console.log(JSON.stringify(report));
