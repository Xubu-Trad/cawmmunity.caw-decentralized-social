import fs from 'node:fs';import assert from 'node:assert/strict';import solc from 'solc';
import {Wallet,Interface,AbiCoder,version} from 'ethers';
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
 operations.push({hash:hex(tx.hash()),rawTransaction:raw,status,gasUsed:x.totalGasSpent.toString(),logs,stateRoot:hex(await stateManager.getStateRoot())});return x;
}
const token=(await send('0x'+contracts.AdmissionTokenFixture.evm.bytecode.object)).createdAddress;assert(token);
const ta=new Interface(contracts.AdmissionTokenFixture.abi),fa=new Interface(contracts.FundedAdmissionResearch.abi),vector=JSON.parse(fs.readFileSync(vectorsPath)).vectors[0];
const funded=(await send('0x'+contracts.FundedAdmissionResearch.evm.bytecode.object+fa.encodeDeploy([token.toString(),payer.address,vector.stakeRoot,[payer.address,payer.address,payer.address]]).slice(2))).createdAddress;assert(funded);
async function read(addr,abi,name,args=[]){
 const before=hex(await stateManager.getStateRoot());await stateManager.checkpoint();
 try{const x=await vm.evm.runCall({to:addr,caller:createAddressFromString(payer.address),data:bytes(abi.encodeFunctionData(name,args)),gasLimit:200000n,isStatic:true});assert(!x.execResult.exceptionError);return abi.decodeFunctionResult(name,hex(x.execResult.returnValue))[0];}
 finally{await stateManager.revert();assert.equal(hex(await stateManager.getStateRoot()),before);}
}
async function snapshot(){
 const next=await read(funded,fa,'nextNonce'),id=await read(funded,fa,'recordIdFor',[next]);
 return {payer:await read(token,ta,'balanceOf',[payer.address]),vault:await read(token,ta,'balanceOf',[funded.toString()]),allowance:await read(token,ta,'allowance',[payer.address,funded.toString()]),nonce:next,liability:await read(funded,fa,'unpaidLiability'),nextBudget:await read(funded,fa,'budgets',[id])};
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

const proofs=JSON.parse(fs.readFileSync(proofPath));assert.equal(proofs.root,vector.stakeRoot);
const claimRejects=[];const paid=[];
function claimArgs(n,k){const v=proofs.accounts[k],p=proofs.accounts[1];return [n,BigInt(k),BigInt(v.weight),v.hashes,v.sums,p.hashes,p.sums];}
async function creditSnapshot(){
 const credits=[],budgets=[],markers=[];
 for(const k of [2,3,4])credits.push(await read(funded,fa,'credits',[k]));
 for(const id of admitted){budgets.push(await read(funded,fa,'budgets',[id]));for(const k of [1,2,3,4])markers.push(await read(funded,fa,'claimed',[id,k]));}
 return {base:await snapshot(),credited:await read(funded,fa,'creditedLiability'),
  credits,budgets,markers};
}
async function badClaim(label,args,reason){
 const before=await creditSnapshot();const x=await send(fa.encodeFunctionData('claim',args),funded.toString(),0,outsider);
 const revert=hex(x.execResult.returnValue);assert.equal(revert.slice(0,10),'0x08c379a0');
 assert.equal(AbiCoder.defaultAbiCoder().decode(['string'],'0x'+revert.slice(10))[0],reason);
 assert.deepEqual(await creditSnapshot(),before);claimRejects.push(label);
}
await badClaim('unfunded nonce',claimArgs(2,2),'UNKNOWN_RECORD');
await badClaim('payer cannot claim',claimArgs(0,1),'PAYER');
let wrong=claimArgs(0,2);wrong[2]=4n;await badClaim('wrong leaf weight',wrong,'TOTAL');
wrong=claimArgs(0,2);wrong[3]=[...wrong[3]];wrong[3][0]='0x'+'ff'.repeat(32);await badClaim('changed recipient proof',wrong,'ROOT');
wrong=claimArgs(0,2);wrong[5]=[...wrong[5]];wrong[5][0]='0x'+'ff'.repeat(32);await badClaim('changed payer proof',wrong,'ROOT');
wrong=claimArgs(0,2);wrong[3]=wrong[3].slice(1);await badClaim('short proof',wrong,'PROOF_LENGTH');
async function claim(n,k,amount){
 const before=await creditSnapshot();await send(fa.encodeFunctionData('claim',claimArgs(n,k)),funded.toString(),1,outsider);
 const after=await creditSnapshot();assert.deepEqual(after.base,before.base);
 assert.equal(after.credited,before.credited+BigInt(amount));assert.equal(after.credits[[2,3,4].indexOf(k)],before.credits[[2,3,4].indexOf(k)]+BigInt(amount));
 assert.equal(after.budgets[n],before.budgets[n]-BigInt(amount));
 assert.equal(after.credited+after.budgets.reduce((a,b)=>a+b,0n),after.base.liability);
 const log=operations.at(-1).logs;assert.equal(log.length,1);const decoded=fa.parseLog(log[0]);assert.equal(decoded.name,'ResearchFeeClaimed');assert.equal(decoded.args.recordId,admitted[n]);assert.equal(decoded.args.accountId,BigInt(k));assert.equal(decoded.args.amount,BigInt(amount));paid.push([n,k,amount]);
}

const withdrawalRejects=[],callbackChecks=[];
async function full(){
 const x=await creditSnapshot();x.owners=[];x.epochs=[];
 for(const k of [2,3,4]){x.owners.push(await read(funded,fa,'owners',[k]));x.epochs.push(await read(funded,fa,'epochs',[k]));}
 x.other=await read(token,ta,'balanceOf',[outsider.address]);x.unallocated=await read(funded,fa,'unallocatedBudget');
 x.callbackCount=await read(token,ta,'callbackCount');return x;
}
async function rejectCall(label,name,args,reason,w=payer){
 const before=await full();const x=await send(fa.encodeFunctionData(name,args),funded.toString(),0,w);
 assert.equal(hex(x.execResult.returnValue).slice(0,10),'0x08c379a0');assert.equal(AbiCoder.defaultAbiCoder().decode(['string'],'0x'+hex(x.execResult.returnValue).slice(10))[0],reason);
 assert.deepEqual(await full(),before);withdrawalRejects.push(label);
}
async function transfer(account,epoch,to,w){
 const before=await creditSnapshot();await send(fa.encodeFunctionData('transferAccount',[account,epoch,to]),funded.toString(),1,w);
 assert.deepEqual(await creditSnapshot(),before);assert.equal(await read(funded,fa,'owners',[account]),to);assert.equal(await read(funded,fa,'epochs',[account]),BigInt(epoch)+1n);
 const e=fa.parseLog(operations.at(-1).logs[0]);assert.equal(e.name,'ResearchAccountTransferred');assert.equal(e.args.epoch,BigInt(epoch)+1n);
}
async function withdraw(account,epoch,amount,w){
 const before=await full(),walletBefore=await read(token,ta,'balanceOf',[w.address]);
 await send(fa.encodeFunctionData('withdraw',[account,epoch,amount]),funded.toString(),1,w);
 const after=await full();assert.equal(after.base.vault,before.base.vault-BigInt(amount));assert.equal(after.base.liability,before.base.liability-BigInt(amount));
 assert.equal(after.credited,before.credited-BigInt(amount));assert.equal(after.credits[account-2],before.credits[account-2]-BigInt(amount));
 assert.deepEqual(after.budgets,before.budgets);assert.equal(after.unallocated,before.unallocated);assert.deepEqual(after.owners,before.owners);assert.deepEqual(after.epochs,before.epochs);
 assert.equal(await read(token,ta,'balanceOf',[w.address]),walletBefore+BigInt(amount));
 assert.equal(after.base.liability,after.unallocated+after.credited);
 const e=fa.parseLog(operations.at(-1).logs.at(-1));assert.equal(e.name,'ResearchWithdrawal');assert.equal(e.args.amount,BigInt(amount));assert.equal(e.args.recipient,w.address);
}
await claim(0,2,1);await badClaim('duplicate positive claim',claimArgs(0,2),'CLAIMED');
await transfer(2,0,outsider.address,payer);await claim(1,2,1);
await rejectCall('former owner','withdraw',[2,0,1],'OWNER');
await rejectCall('new owner stale epoch','withdraw',[2,0,1],'EPOCH',outsider);
await rejectCall('excess withdrawal','withdraw',[2,1,3],'CREDIT',outsider);
await rejectCall('zero amount','withdraw',[2,1,0],'AMOUNT',outsider);
await rejectCall('other account','withdraw',[3,0,1],'OWNER',outsider);
await rejectCall('unknown account','withdraw',[5,0,1],'ACCOUNT',outsider);
await rejectCall('nonowner transfer','transferAccount',[2,1,payer.address],'OWNER');
await rejectCall('zero new owner','transferAccount',[2,1,'0x'+'00'.repeat(20)],'ZERO_OWNER',outsider);
for(const [mode,reason]of [[1,'TOKEN_FALSE'],[2,'TOKEN_REVERT'],[3,'RECIPIENT'],[4,'OUTBOUND']]){
 await send(ta.encodeFunctionData('setOutboundMode',[mode]),token.toString());
 await rejectCall('token mode '+mode,'withdraw',[2,1,2],reason,outsider);
}
await send(ta.encodeFunctionData('setOutboundMode',[0]),token.toString());
await withdraw(2,1,2,outsider);assert.equal((await full()).unallocated,8n);
await rejectCall('spent credit','withdraw',[2,1,1],'CREDIT',outsider);
await transfer(2,1,payer.address,outsider);await rejectCall('ABA old epoch','withdraw',[2,0,1],'EPOCH');
await claim(0,4,0);await badClaim('duplicate zero claim',claimArgs(0,4),'CLAIMED');
await claim(1,4,0);await claim(0,3,4);await claim(1,3,4);
// Empty proof arrays are ABI-valid. The shared lock must reject before proof validation.
const callbacks=[['admit',[2]],['claim',[0,3,5,[],[],[],[]]],['transferAccount',[3,0,outsider.address]],['withdraw',[3,0,1]]];
for(const [name,args]of callbacks){
 await send(ta.encodeFunctionData('setCallback',[funded.toString(),fa.encodeFunctionData(name,args)]),token.toString());
 const count=await read(token,ta,'callbackCount');await withdraw(3,0,1,payer);
 assert.equal(await read(token,ta,'callbackCount'),count+1n);assert.equal(await read(token,ta,'callbackSuccess'),false);
 const error=await read(token,ta,'callbackResult');assert.equal(error.slice(0,10),'0x08c379a0');assert.equal(AbiCoder.defaultAbiCoder().decode(['string'],'0x'+error.slice(10))[0],'REENTRY');callbackChecks.push(name);
}
await send(ta.encodeFunctionData('setCallback',['0x'+'00'.repeat(20),'0x']),token.toString());await withdraw(3,0,4,payer);
const completed=await full();assert.deepEqual(completed.credits,[0n,0n,0n]);assert.deepEqual(completed.budgets,[0n,0n]);assert.equal(completed.base.vault,0n);assert.equal(completed.base.liability,0n);assert.equal(completed.credited,0n);assert.equal(completed.unallocated,0n);
assert.equal(completed.base.payer,9n);assert.equal(completed.other,91n);assert.deepEqual(completed.epochs,[2n,0n,0n]);
const report={status:'EXPERIMENTAL_ACCOUNT_BOUND_WITHDRAWAL_ONLY',localTransactions:operations.length,admissionRejections:negatives,claimRejections:claimRejects,withdrawalRejections:withdrawalRejects,callbackChecks,
 final:JSON.parse(JSON.stringify(completed,(_,v)=>typeof v==='bigint'?v.toString():v)),
 limits:'Fixed constructor owners and snapshot; no NFT registry, adopted C007 policy, real CAW proof, independent execution or production readiness.'};
for(const [name,value]of Object.entries({'compiler-input.json':input,'operations.json':operations,'result.json':report}))fs.writeFileSync(out+'/'+name,JSON.stringify(value,null,2)+'\n');
console.log(JSON.stringify(report));
