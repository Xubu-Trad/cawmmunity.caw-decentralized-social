import fs from 'node:fs';import assert from 'node:assert/strict';import solc from 'solc';
import {Wallet,Interface,AbiCoder,version} from 'ethers';
import {createVM,runTx} from '@ethereumjs/vm';import {createTxFromRLP} from '@ethereumjs/tx';import {createBlock} from '@ethereumjs/block';
import {MerkleStateManager} from '@ethereumjs/statemanager';import {createCustomCommon,Mainnet,Hardfork} from '@ethereumjs/common';import {Account,createAddressFromString} from '@ethereumjs/util';
import {bindCandidateAdmission} from './c007-admission-binding.mjs';
const [sourcePath,out,vectorsPath]=process.argv.slice(2);assert(!fs.existsSync(out));fs.mkdirSync(out);
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
 operations.push({hash:hex(tx.hash()),rawTransaction:raw,status,gasUsed:x.totalGasSpent.toString(),logs,stateRoot:hex(await stateManager.getStateRoot())});return x;
}
const token=(await send('0x'+contracts.AdmissionTokenFixture.evm.bytecode.object)).createdAddress;assert(token);
const ta=new Interface(contracts.AdmissionTokenFixture.abi),fa=new Interface(contracts.FundedAdmissionResearch.abi),vector=JSON.parse(fs.readFileSync(vectorsPath)).vectors[0];
const funded=(await send('0x'+contracts.FundedAdmissionResearch.evm.bytecode.object+fa.encodeDeploy([token.toString(),payer.address,vector.stakeRoot]).slice(2))).createdAddress;assert(funded);
async function read(addr,abi,name,args=[]){
 const before=hex(await stateManager.getStateRoot());await stateManager.checkpoint();
 try{const x=await vm.evm.runCall({to:addr,caller:createAddressFromString(payer.address),data:bytes(abi.encodeFunctionData(name,args)),gasLimit:200000n,isStatic:true});assert(!x.execResult.exceptionError);return abi.decodeFunctionResult(name,hex(x.execResult.returnValue))[0];}
 finally{await stateManager.revert();assert.equal(hex(await stateManager.getStateRoot()),before);}
}
async function snapshot(){
 const next=await read(funded,fa,'nextNonce'),id=await read(funded,fa,'recordIdFor',[next]);
 return {payer:await read(token,ta,'balanceOf',[payer.address]),vault:await read(token,ta,'balanceOf',[funded.toString()]),allowance:await read(token,ta,'allowance',[payer.address,funded.toString()]),nonce:next,liability:await read(funded,fa,'unclaimedLiability'),nextBudget:await read(funded,fa,'budgets',[id])};
}
const negatives=[];
async function reject(name,nonce,w=payer){
 const expected={'no allowance':'ALLOWANCE','insufficient allowance':'ALLOWANCE','duplicate nonce':'NONCE','false after token mutation':'TOKEN_FALSE','unauthorized caller':'PAYER','insufficient payer balance':'FUNDS'}[name];assert(expected);
 const before=await snapshot();const result=await send(fa.encodeFunctionData('admit',[nonce]),funded.toString(),0,w);
 const reverted=hex(result.execResult.returnValue);assert.equal(reverted.slice(0,10),'0x08c379a0');
 assert.equal(AbiCoder.defaultAbiCoder().decode(['string'],'0x'+reverted.slice(10))[0],expected);
 assert.deepEqual(await snapshot(),before);negatives.push(name);
}
async function approve(n){await send(ta.encodeFunctionData('approve',[funded.toString(),n]),token.toString());}
const admitted=[];
async function success(nonce){
 const before=await snapshot();await send(fa.encodeFunctionData('admit',[nonce]),funded.toString());const after=await snapshot();
 assert.equal(after.payer,before.payer-5n);assert.equal(after.vault,before.vault+5n);assert.equal(after.liability,before.liability+5n);assert.equal(after.nonce,nonce+1n);assert.equal(after.nextBudget,0n);
 const logs=operations.at(-1).logs;assert.equal(logs.length,1);const event=bindCandidateAdmission(logs[0],{chainId:'31337',emitter:funded.toString(),profile:vector.selection.profile});
 assert.equal(event.nonce,nonce.toString());assert.equal(event.fee,'5');assert.equal(await read(funded,fa,'budgets',[event.recordId]),5n);admitted.push(event.recordId);
}
await reject('no allowance',0n);await approve(4n);await reject('insufficient allowance',0n);await approve(100n);await success(0n);
await reject('duplicate nonce',0n);
await send(ta.encodeFunctionData('setReturnFalse',[true]),token.toString());await reject('false after token mutation',1n);
await send(ta.encodeFunctionData('setReturnFalse',[false]),token.toString());await reject('unauthorized caller',1n,outsider);await success(1n);
await send(ta.encodeFunctionData('transfer',[outsider.address,89n]),token.toString());await reject('insufficient payer balance',2n);
const final=await snapshot();assert.deepEqual(final,{payer:1n,vault:10n,allowance:90n,nonce:2n,liability:10n,nextBudget:0n});
assert.equal(await read(token,ta,'balanceOf',[outsider.address]),89n);
for(const id of admitted)assert.equal(await read(funded,fa,'budgets',[id]),5n);
const report={status:'LOCAL_MOCK_FUNDED_ADMISSION_ONLY',localTransactions:operations.length,successfulAdmissions:2,rejected:negatives,
 final:Object.fromEntries(Object.entries(final).map(([k,v])=>[k,v.toString()])),outsiderMockBalance:'89',recordIds:admitted,
 limits:'Single fixed payer and constructor snapshot, direct calls, fee5 mock base units, no claims/withdrawals/NFT/stake authentication or actual CAW. Local EVM only; no adopted economics or production backing certification.'};
for(const [name,value]of Object.entries({'compiler-input.json':input,'operations.json':operations,'result.json':report}))fs.writeFileSync(out+'/'+name,JSON.stringify(value,null,2)+'\n');
console.log(JSON.stringify(report));
