// Local EVM creation/call research; not signed Ethereum transaction execution.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import solc from 'solc';
import {keccak_256} from '@noble/hashes/sha3.js';
import {secp256k1} from '@noble/curves/secp256k1.js';
import {createAddressFromPrivateKey} from '@ethereumjs/util';
import {Common,Hardfork,Mainnet} from '@ethereumjs/common';
import {createEVM} from '@ethereumjs/evm';

const out=process.argv[2];assert(out&&!fs.existsSync(out));fs.mkdirSync(out);
const save=(n,v)=>fs.writeFileSync(`${out}/${n}`,JSON.stringify(v,(_,x)=>typeof x==='bigint'?x.toString():x,2)+'\n');
const source=fs.readFileSync(new URL('./DeployedCustodyStakeResearch.sol',import.meta.url),'utf8');
const walletSource=fs.readFileSync(new URL('./LifecycleWalletFixture.sol',import.meta.url),'utf8');
const input={language:'Solidity',sources:{'DeployedCustodyStakeResearch.sol':{content:source},'LifecycleWalletFixture.sol':{content:walletSource}},settings:{optimizer:{enabled:true,runs:200},evmVersion:'shanghai',outputSelection:{'*':{'*':['abi','evm.bytecode.object','evm.deployedBytecode.object','evm.methodIdentifiers']}}}};
assert(solc.version().startsWith('0.8.30+'));save('compiler-input.json',input);
const compiled=JSON.parse(solc.compile(JSON.stringify(input)));save('compiler-output.json',compiled);
assert(!(compiled.errors??[]).some(x=>x.severity==='error'),JSON.stringify(compiled.errors));
const contracts={...compiled.contracts['DeployedCustodyStakeResearch.sol'],...compiled.contracts['LifecycleWalletFixture.sol']};
const W=x=>Buffer.from(BigInt(x).toString(16).padStart(64,'0'),'hex');
const hex=b=>Buffer.from(b).toString('hex');const K=b=>Buffer.from(keccak_256(b));
const H=b=>crypto.createHash('sha256').update(b).digest();const abi=xs=>Buffer.concat(xs.map(W));
const A=createAddressFromPrivateKey(W(1)),B=createAddressFromPrivateKey(W(2)),relay=createAddressFromPrivateKey(W(3));
const evm=await createEVM({common:new Common({chain:Mainnet,hardfork:Hardfork.Shanghai})});
const rows=[];let token,vault,wallet;
function selector(contract,name){const a=Object.entries(contracts[contract].evm.methodIdentifiers).filter(([s])=>s.startsWith(name+'('));assert.equal(a.length,1);return Buffer.from(a[0][1],'hex');}
function reason(b){const v=Buffer.from(b);assert.equal(hex(v.subarray(0,4)),'08c379a0');const n=Number(BigInt('0x'+hex(v.subarray(36,68))));return v.subarray(68,68+n).toString();}
async function create(name,args=Buffer.alloc(0),expected){
 const data=Buffer.concat([Buffer.from(contracts[name].evm.bytecode.object,'hex'),args]);
 const r=await evm.runCall({caller:relay,data,gasLimit:15000000n});
 if(expected){assert.equal(r.execResult.exceptionError?.error,'revert');assert.equal(reason(r.execResult.returnValue),expected);}
 else {assert.equal(r.execResult.exceptionError,undefined);assert(r.createdAddress);assert((await evm.stateManager.getCode(r.createdAddress)).length>0);}
 rows.push({name:'create_'+name,expected:expected??'OK',address:r.createdAddress?.toString(),creationData:'0x'+hex(data),gas:r.execResult.executionGasUsed});
 return r.createdAddress;
}
const cname='DeployedCustodyStakeResearch';
async function call(to,name,args=[],caller=A,expected,raw){
 const type=to===token?'MockTokenResearch':to===wallet?'LifecycleWalletFixture':cname;
 const data=raw??Buffer.concat([selector(type,name),abi(args)]);
 const r=(await evm.runCall({caller,to,data,gasLimit:10000000n,block:{header:{number:1n,coinbase:relay,timestamp:15n,difficulty:0n,prevRandao:new Uint8Array(32),gasLimit:30000000n,baseFeePerGas:undefined,slotNumber:0n,getBlobGasPrice:()=>undefined}}})).execResult;
 if(expected){assert.equal(r.exceptionError?.error,'revert',name);assert.equal(reason(r.returnValue),expected,name);assert.equal((r.logs??[]).length,0);}
 else assert.equal(r.exceptionError,undefined,name);
 rows.push({name,caller:caller.toString(),to:to.toString(),expected:expected??'OK',calldata:'0x'+hex(data),gas:r.executionGasUsed,logs:(r.logs??[]).map(([a,t,d])=>({address:hex(a),topics:t.map(hex),data:hex(d)}))});return r;
}
async function get(to,name,args=[]){const type=to===token?'MockTokenResearch':to===wallet?'LifecycleWalletFixture':cname;const r=(await evm.runCall({caller:A,to,data:Buffer.concat([selector(type,name),abi(args)]),gasLimit:300000n})).execResult;assert.equal(r.exceptionError,undefined);return BigInt('0x'+hex(r.returnValue));}
async function state(){const s={};for(const k of ['root','totalStake','liabilities','poolDust','credit1','credit2','credit3','stake1','stake2','stake3','owner1','owner2','owner3','epoch1','epoch2','epoch3'])s[k]=String(await get(vault,k));s.nonce=String(await get(vault,'postNonces',[1]));s.balance=String(await get(token,'balanceOf',[BigInt(vault.toString())]));return s;}
function invariant(s){assert.equal(BigInt(s.liabilities),BigInt(s.credit1)+BigInt(s.credit2)+BigInt(s.credit3));assert.equal(BigInt(s.balance),BigInt(s.liabilities)+BigInt(s.poolDust));assert.equal(BigInt(s.totalStake),BigInt(s.stake1)+BigInt(s.stake2)+BigInt(s.stake3));for(let i=1;i<=3;i++)assert(BigInt(s['stake'+i])<=BigInt(s['credit'+i]));}
const empty=[{hash:H(Buffer.from([0])),sum:0n}];
function branch(l,r){return {hash:H(Buffer.concat([Buffer.from([2]),l.hash,W(l.sum),r.hash,W(r.sum)])),sum:l.sum+r.sum};}
for(let i=0;i<256;i++)empty.push(branch(empty[i],empty[i]));
const stakes=[0n,0n,0n];
function tree(){let level=new Map(stakes.map((s,i)=>[BigInt(i+1),{hash:H(Buffer.concat([Buffer.from([1]),W(i+1),W(s)])),sum:s}]));const levels=[level];for(let h=0;h<256;h++){const next=new Map();for(const i of level.keys()){const p=i>>1n;if(!next.has(p))next.set(p,branch(level.get(p*2n)??empty[h],level.get(p*2n+1n)??empty[h]));}level=next;levels.push(level);}const n=level.get(0n);return {root:H(Buffer.concat([Buffer.from('CAW_STAKE_TREE_RESEARCH_V1\0'),Buffer.alloc(32,0x11),n.hash,W(n.sum)])),proof(id){let i=BigInt(id);return Array.from({length:256},(_,h)=>{const x=levels[h].get(i^1n)??empty[h];i>>=1n;return x;});}};}
function dynamic(b){return Buffer.concat([W(b.length),b,Buffer.alloc((32-b.length%32)%32)]);}
function encoded(type,name,args){return Buffer.concat([selector(type,name),abi(args)]);}
async function forward(target,data,expected,caller=A){
 const raw=Buffer.concat([selector('LifecycleWalletFixture','execute'),abi([BigInt(target.toString()),64]),dynamic(data)]);
 return call(wallet,'execute',[],caller,expected,raw);
}
function postData(req,signature,text){const tail=dynamic(signature);return Buffer.concat([selector(cname,'settleFixedPool1'),abi([...req,288,288+tail.length]),tail,dynamic(text)]);}
token=await create('MockTokenResearch');
wallet=await create('LifecycleWalletFixture',abi([BigInt(A.toString())]));
vault=await create(cname,abi([BigInt(token.toString()),BigInt(wallet.toString()),BigInt(A.toString()),BigInt(B.toString())]));
const initial=await state();invariant(initial);
const unit=10n**18n,F=5000n*unit;
for(const [who,amount]of [[wallet,6000n*unit],[A,10n*unit],[B,10n*unit]])await call(token,'mint',[BigInt(who.toString()),amount]);
await forward(token,encoded('MockTokenResearch','approve',[BigInt(vault.toString()),6000n*unit]));
await forward(vault,encoded(cname,'deposit',[1,0,6000n*unit]));
for(const [id,who]of [[2,A],[3,B]]){await call(token,'approve',[BigInt(vault.toString()),10n*unit],who);await call(vault,'deposit',[id,0,10n*unit],who);}
for(const [id,amount]of [[1,1000n*unit],[2,3n*unit],[3,8n*unit]]){
 const proof=tree().proof(id);const data=Buffer.concat([selector(cname,'changeStake'),abi([id,0,1,amount,0]),...proof.map(n=>Buffer.concat([n.hash,W(n.sum)]))]);
 if(id===1)await forward(vault,data);else await call(vault,'changeStake',[],id===3?B:A,undefined,data);
 stakes[id-1]=amount;assert.equal(await get(vault,'root'),BigInt('0x'+hex(tree().root)));invariant(await state());
}
const text=Buffer.from('contract owned lifecycle');const signature=Buffer.from('aabbcc','hex');
const req=[1n,0n,0n,10n,20n,await get(vault,'root'),BigInt('0x'+hex(K(text)))];
const digest=(await call(vault,'postDigest',req)).returnValue;
const configuration=[BigInt('0x'+hex(digest)),BigInt('0x'+hex(K(signature)))];
await call(wallet,'configure',[...configuration,1]);
const before=await state();const data=postData(req,signature,text);
await call(vault,'settleFixedPool1',[],relay,'WALLET_SIGNATURE',data);assert.deepEqual(await state(),before);
await call(wallet,'configure',[...configuration,0]);
await call(vault,'settleFixedPool1',[],relay,undefined,data);
const after=await state();invariant(after);assert.equal(after.nonce,'1');assert.equal(BigInt(before.credit1)-BigInt(after.credit1),F);
const share2=F*3n/11n,share3=F*8n/11n;
assert.equal(BigInt(after.credit2)-BigInt(before.credit2),share2);assert.equal(BigInt(after.credit3)-BigInt(before.credit3),share3);assert.equal(after.poolDust,'1');
await call(vault,'settleFixedPool1',[],relay,'NONCE',data);assert.deepEqual(await state(),after);
await call(vault,'withdraw',[1,0,1],A,'OWNER');assert.deepEqual(await state(),after);
await forward(vault,encoded(cname,'withdraw',[1,0,1]),'CONTROLLER',B);assert.deepEqual(await state(),after);
const proof=tree().proof(1);await forward(vault,Buffer.concat([selector(cname,'changeStake'),abi([1,0,0,unit,0]),...proof.map(n=>Buffer.concat([n.hash,W(n.sum)]))]));stakes[0]-=unit;
assert.equal(await get(vault,'root'),BigInt('0x'+hex(tree().root)));
await forward(vault,encoded(cname,'withdraw',[1,0,unit]));
assert.equal(await get(token,'balanceOf',[BigInt(wallet.toString())]),unit);
const next=[...req];next[2]=1n;next[5]=await get(vault,'root');
await forward(vault,encoded(cname,'transferAccount',[1,0,BigInt(B.toString())]));
const transferred=await state();assert.equal(transferred.epoch1,'1');
await forward(vault,encoded(cname,'withdraw',[1,0,1]),'OWNER');assert.deepEqual(await state(),transferred);
await call(vault,'settleFixedPool1',[],relay,'EPOCH',postData(next,signature,text));assert.deepEqual(await state(),transferred);
next[1]=1n;const newDigest=(await call(vault,'postDigest',next)).returnValue;
const sig=Buffer.from(secp256k1.sign(newDigest,W(2),{prehash:false,format:'recovered'}));const eoaSignature=Buffer.concat([sig.subarray(1),Buffer.from([27+sig[0]])]);
const verify=Buffer.concat([selector(cname,'verifyPost'),abi([...next,256]),dynamic(eoaSignature)]);
assert.equal(BigInt('0x'+hex((await call(vault,'verifyPost',[],relay,undefined,verify)).returnValue)),1n);
const proof2=tree().proof(1);await call(vault,'changeStake',[],B,undefined,Buffer.concat([selector(cname,'changeStake'),abi([1,1,0,unit,0]),...proof2.map(n=>Buffer.concat([n.hash,W(n.sum)]))]));stakes[0]-=unit;
await call(vault,'withdraw',[1,1,unit],B);
assert.equal(await get(token,'balanceOf',[BigInt(B.toString())]),unit);
const final=await state();invariant(final);assert.equal(final.credit1,String(998n*unit));assert.equal(final.stake1,String(998n*unit));
save('results.json',{schema:'caw-contract-wallet-lifecycle/1',sourceSha256:hex(H(Buffer.from(source))),walletSha256:hex(H(Buffer.from(walletSource))),compiler:solc.version(),initial,before,after,final,rows,constructorExecuted:true,directCodeOrStorageWrites:false,signedEthereumTransactions:false,realWalletSigner:false,policyAdopted:false});
console.log('CONTRACT_WALLET_LIFECYCLE_AND_ROLLBACK=PASS');
