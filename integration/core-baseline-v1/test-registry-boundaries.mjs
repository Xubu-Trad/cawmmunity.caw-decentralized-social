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

const zero='0x'+'00'.repeat(20),zeroHash='0x'+'00'.repeat(32),cases=[];
const fa=new Interface(contracts.FundedAdmissionResearch.abi),ta=new Interface(contracts.AdmissionTokenFixture.abi),ra=new Interface(contracts.TestAccountRegistry.abi),ma=new Interface(contracts.MutableRegistryBoundaryFixture.abi);
const vector=JSON.parse(fs.readFileSync(vectorsPath)).vectors[0],proofs=JSON.parse(fs.readFileSync(proofPath));
async function deploy(name,args=[]){const i=new Interface(contracts[name].abi);const x=await send('0x'+contracts[name].evm.bytecode.object+i.encodeDeploy(args).slice(2));assert(x.createdAddress);return x.createdAddress;}
const token=await deploy('AdmissionTokenFixture'),registry=await deploy('TestAccountRegistry',[payer.address,payer.address]);
const codeHash=async a=>keccak256(hex(await stateManager.getCode(a)));
const registryHash=await codeHash(registry),tokenHash=await codeHash(token);
function reason(x){const d=hex(x.execResult.returnValue);return d.startsWith('0x08c379a0')?AbiCoder.defaultAbiCoder().decode(['string'],'0x'+d.slice(10))[0]:d;}
const standard=[token.toString(),payer.address,vector.stakeRoot,registry.toString(),registryHash];
for(const [name,index,value,why]of [['zero token',0,zero,'0x'],['EOA token',0,payer.address,'0x'],['zero payer',1,zero,'0x'],['zero registry',3,zero,'REGISTRY'],['EOA registry',3,outsider.address,'REGISTRY'],['wrong registry hash',4,zeroHash,'REGISTRY']]){
 const args=[...standard];args[index]=value;const x=await send('0x'+contracts.FundedAdmissionResearch.evm.bytecode.object+fa.encodeDeploy(args).slice(2),undefined,0);assert.equal(reason(x),why);cases.push({name,outcome:'rejected',reason:why});
}
const emptyRoot=await deploy('FundedAdmissionResearch',[token.toString(),payer.address,zeroHash,registry.toString(),registryHash]);
cases.push({name:'zero snapshot root',outcome:'constructor accepted; no claim usability asserted'});
const noAuthority=await deploy('FundedAdmissionResearch',[token.toString(),payer.address,vector.stakeRoot,token.toString(),tokenHash]);
const absent=await send(fa.encodeFunctionData('owners',[2]),noAuthority.toString(),0);assert.equal(reason(absent),'0x');
cases.push({name:'matching hash without authority ABI',outcome:'constructor accepted; authority read rejected'});
const mutable=await deploy('MutableRegistryBoundaryFixture',[payer.address]),mutableHash=await codeHash(mutable);
const vault=await deploy('FundedAdmissionResearch',[token.toString(),payer.address,vector.stakeRoot,mutable.toString(),mutableHash]);
async function read(addr,abi,name,args=[]){await stateManager.checkpoint();try{const x=await vm.evm.runCall({to:addr,caller:createAddressFromString(payer.address),data:bytes(abi.encodeFunctionData(name,args)),gasLimit:200000n,isStatic:true});assert(!x.execResult.exceptionError);return abi.decodeFunctionResult(name,hex(x.execResult.returnValue))[0];}finally{await stateManager.revert();}}
async function snap(){return {payer:await read(token,ta,'balanceOf',[payer.address]),outsider:await read(token,ta,'balanceOf',[outsider.address]),vault:await read(token,ta,'balanceOf',[vault.toString()]),credit:await read(vault,fa,'credits',[2]),liability:await read(vault,fa,'unpaidLiability'),unallocated:await read(vault,fa,'unallocatedBudget'),credited:await read(vault,fa,'creditedLiability')};}
await send(ta.encodeFunctionData('approve',[vault.toString(),5]),token.toString());await send(fa.encodeFunctionData('admit',[0]),vault.toString());
const p=proofs.accounts[1],v=proofs.accounts[2];await send(fa.encodeFunctionData('claim',[0,2,3,v.hashes,v.sums,p.hashes,p.sums]),vault.toString());
for(const [mode,name,why]of [[1,'zero owner','ZERO_OWNER'],[2,'reverting registry','REGISTRY_UNAVAILABLE'],[3,'short authority return','0x']]){
 await send(ma.encodeFunctionData('setMode',[mode]),mutable.toString());const before=await snap();const x=await send(fa.encodeFunctionData('withdraw',[2,0,1]),vault.toString(),0);assert.equal(reason(x),why);assert.deepEqual(await snap(),before);assert.equal(await codeHash(mutable),mutableHash);cases.push({name,outcome:'withdrawal rejected; checked accounting unchanged',reason:why});
}
await send(ma.encodeFunctionData('setMode',[0]),mutable.toString());
// Unprivileged attacker changes dishonest registry state without changing its code.
await send(ma.encodeFunctionData('setOwner',[outsider.address]),mutable.toString(),1,outsider);assert.equal(await codeHash(mutable),mutableHash);assert.equal(await read(vault,fa,'epochs',[2]),0n);
const before=await snap();const old=await send(fa.encodeFunctionData('withdraw',[2,0,1]),vault.toString(),0);assert.equal(reason(old),'OWNER');assert.deepEqual(await snap(),before);
await send(fa.encodeFunctionData('withdraw',[2,0,1]),vault.toString(),1,outsider);
const final=await snap();assert.equal(final.payer,95n);assert.equal(final.outsider,1n);assert.equal(final.vault,4n);assert.equal(final.credit,0n);assert.equal(final.liability,4n);assert.equal(final.unallocated,4n);assert.equal(final.credited,0n);
cases.push({name:'same runtime hash, dishonest owner replacement at unchanged epoch',outcome:'former owner rejected; attacker-reported owner withdrew1 mock unit',boundary:'code pinning does not authenticate registry policy or state'});
const report={status:'REGISTRY_TRUST_BOUNDARY_DEMONSTRATED',transactions:operations.length,cases,final:JSON.parse(JSON.stringify(final,(_,v)=>typeof v==='bigint'?v.toString():v)),limits:'Synthetic deliberately dishonest registry; not a defect reproduced in TestAccountRegistry, not a live exploit or safe-registry certification. Single engine; no independent reconstruction or second-engine coverage for this new history.'};
for(const [n,value]of Object.entries({'compiler-input.json':input,'operations.json':operations,'result.json':report}))fs.writeFileSync(out+'/'+n,JSON.stringify(value,null,2)+'\n');console.log(JSON.stringify(report));
