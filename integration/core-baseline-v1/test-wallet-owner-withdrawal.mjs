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
const wa=new Interface(contracts.AccountOwnerWalletResearch.abi);
const wallet=(await send('0x'+contracts.AccountOwnerWalletResearch.evm.bytecode.object+wa.encodeDeploy([payer.address]).slice(2))).createdAddress;assert(wallet);
async function walletCall(target,data,status=1,w=payer){return send(wa.encodeFunctionData('execute',[target,data]),wallet.toString(),status,w);}
async function walletSnapshot(){return {...await snap(),walletBalance:await read(token,ta,'balanceOf',[wallet.toString()])};}
async function rejectedWallet(name,target,data,reason,w=payer){const before=await walletSnapshot();const x=await walletCall(target,data,0,w);assert.equal(hex(x.execResult.returnValue).slice(0,10),'0x08c379a0');assert.equal(AbiCoder.defaultAbiCoder().decode(['string'],'0x'+hex(x.execResult.returnValue).slice(10))[0],reason);assert.deepEqual(await walletSnapshot(),before);cases.push(name);}
await send(ta.encodeFunctionData('approve',[funded.toString(),100]),token.toString());
for(const n of [0,1])await send(fa.encodeFunctionData('admit',[n]),funded.toString());
await claim(0);await claim(1);
await send(registryAbi.encodeFunctionData('safeTransferFrom(address,address,uint256)',[payer.address,wallet.toString(),2]),registryAddress.toString());
assert.equal((await read(funded,fa,'owners',[2])).toLowerCase(),wallet.toString().toLowerCase());assert.equal(await read(funded,fa,'epochs',[2]),1n);
await reject('controller cannot bypass wallet',[2,1,1],'OWNER',payer);
await rejectedWallet('outsider cannot execute wallet',funded.toString(),fa.encodeFunctionData('withdraw',[2,1,1]),'CONTROLLER',outsider);
await rejectedWallet('wallet rejects stale NFT epoch',funded.toString(),fa.encodeFunctionData('withdraw',[2,0,1]),'EPOCH');
await send(ta.encodeFunctionData('setOutboundMode',[1]),token.toString());
await rejectedWallet('token false rolls back wallet withdrawal',funded.toString(),fa.encodeFunctionData('withdraw',[2,1,1]),'TOKEN_FALSE');
await send(ta.encodeFunctionData('setOutboundMode',[0]),token.toString());
await walletCall(funded.toString(),fa.encodeFunctionData('withdraw',[2,1,1]));
assert.equal(await read(token,ta,'balanceOf',[wallet.toString()]),1n);assert.equal(await read(funded,fa,'credits',[2]),1n);
await walletCall(registryAddress.toString(),registryAbi.encodeFunctionData('transferFrom',[wallet.toString(),outsider.address,2]));
await rejectedWallet('former wallet loses withdrawal authority',funded.toString(),fa.encodeFunctionData('withdraw',[2,2,1]),'OWNER');
await reject('new owner stale epoch',[2,1,1],'EPOCH',outsider);
await send(fa.encodeFunctionData('withdraw',[2,2,1]),funded.toString(),1,outsider);
const final=await walletSnapshot();assert.equal(final.walletBalance,1n);assert.equal(final.other,1n);assert.equal(final.payer,90n);assert.equal(final.vault,8n);assert.equal(final.liability,8n);assert.equal(final.credit,0n);assert.equal(final.epoch,2n);assert.equal(final.owner,outsider.address);assert.equal(final.credited,0n);assert.equal(final.unallocated,8n);
const report={status:'CONTRACT_WALLET_OWNER_RESEARCH_ONLY',transactions:operations.length,rejected:cases,final:JSON.parse(JSON.stringify(final,(_,v)=>typeof v==='bigint'?v.toString():v)),limits:'Direct immutable-controller test wallet only; no ERC1271, ERC4337, signature delegation, real CAW, public registration, adopted economics, independent reconstruction or second-engine replay.'};
for(const [name,value]of Object.entries({'compiler-input.json':input,'operations.json':operations,'result.json':report}))fs.writeFileSync(out+'/'+name,JSON.stringify(value,null,2)+'\n');console.log(JSON.stringify(report));
