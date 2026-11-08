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

const parent=process.argv[2];assert(parent&&!fs.existsSync(parent));fs.mkdirSync(parent);
async function scenario(variant,action){
const out=parent+'/'+variant+'-'+action;fs.mkdirSync(out);
const save=(n,v)=>fs.writeFileSync(`${out}/${n}`,JSON.stringify(v,(_,x)=>typeof x==='bigint'?x.toString():x,2)+'\n');
let source=fs.readFileSync(new URL(variant,import.meta.url),'utf8');
const vaultSourceHash=crypto.createHash('sha256').update(source).digest('hex');
// Only the mock token is instrumented. Vault functions remain the selected variant.
source=source.replace('contract MockTokenResearch {',`contract MockTokenResearch {
    bytes public payload; address public target; bool public armed;
    bool public callbackAccepted; bytes public callbackResult;
    function configure(address t,bytes calldata p,bool a) external {target=t;payload=p;armed=a;}
    function attempt() private {if(armed){(callbackAccepted,callbackResult)=target.call(payload);}}
`);
const boundary=source.indexOf('interface IERC20Research');
source=source.slice(0,boundary).replaceAll('return true;', 'attempt(); return true;')+source.slice(boundary);

const input={language:'Solidity',sources:{'DeployedCustodyStakeResearch.sol':{content:source}},settings:{optimizer:{enabled:true,runs:200},evmVersion:'shanghai',outputSelection:{'*':{'*':['abi','evm.bytecode.object','evm.deployedBytecode.object','evm.methodIdentifiers']}}}};
assert(solc.version().startsWith('0.8.30+'));save('compiler-input.json',input);
const compiled=JSON.parse(solc.compile(JSON.stringify(input)));save('compiler-output.json',compiled);
assert(!(compiled.errors??[]).some(x=>x.severity==='error'),JSON.stringify(compiled.errors));
const contracts=compiled.contracts['DeployedCustodyStakeResearch.sol'];
const W=x=>Buffer.from(BigInt(x).toString(16).padStart(64,'0'),'hex');
const hex=b=>Buffer.from(b).toString('hex');const K=b=>Buffer.from(keccak_256(b));
const H=b=>crypto.createHash('sha256').update(b).digest();const abi=xs=>Buffer.concat(xs.map(W));
const A=createAddressFromPrivateKey(W(1)),B=createAddressFromPrivateKey(W(2)),relay=createAddressFromPrivateKey(W(3));
const evm=await createEVM({common:new Common({chain:Mainnet,hardfork:Hardfork.Shanghai})});
const rows=[];let token,vault;
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
 const type=to===token?'MockTokenResearch':cname;
 const data=raw??Buffer.concat([selector(type,name),abi(args)]);
 const r=(await evm.runCall({caller,to,data,gasLimit:10000000n,block:{header:{number:1n,coinbase:relay,timestamp:15n,difficulty:0n,prevRandao:new Uint8Array(32),gasLimit:30000000n,baseFeePerGas:undefined,slotNumber:0n,getBlobGasPrice:()=>undefined}}})).execResult;
 if(expected){assert.equal(r.exceptionError?.error,'revert',name);assert.equal(reason(r.returnValue),expected,name);assert.equal((r.logs??[]).length,0);}
 else assert.equal(r.exceptionError,undefined,name);
 rows.push({name,caller:caller.toString(),to:to.toString(),expected:expected??'OK',calldata:'0x'+hex(data),gas:r.executionGasUsed,logs:(r.logs??[]).map(([a,t,d])=>({address:hex(a),topics:t.map(hex),data:hex(d)}))});return r;
}
async function get(to,name,args=[]){const type=to===token?'MockTokenResearch':cname;const r=(await evm.runCall({caller:A,to,data:Buffer.concat([selector(type,name),abi(args)]),gasLimit:300000n})).execResult;assert.equal(r.exceptionError,undefined);return BigInt('0x'+hex(r.returnValue));}
async function state(){const s={};for(const k of ['root','totalStake','liabilities','poolDust','credit1','credit2','credit3','stake1','stake2','stake3','owner1','owner2','owner3','epoch1','epoch2','epoch3'])s[k]=String(await get(vault,k));s.nonce=String(await get(vault,'postNonces',[1]));s.balance=String(await get(token,'balanceOf',[BigInt(vault.toString())]));return s;}
function invariant(s){assert.equal(BigInt(s.liabilities),BigInt(s.credit1)+BigInt(s.credit2)+BigInt(s.credit3));assert.equal(BigInt(s.balance),BigInt(s.liabilities)+BigInt(s.poolDust));assert.equal(BigInt(s.totalStake),BigInt(s.stake1)+BigInt(s.stake2)+BigInt(s.stake3));for(let i=1;i<=3;i++)assert(BigInt(s['stake'+i])<=BigInt(s['credit'+i]));}
const empty=[{hash:H(Buffer.from([0])),sum:0n}];
function branch(l,r){return {hash:H(Buffer.concat([Buffer.from([2]),l.hash,W(l.sum),r.hash,W(r.sum)])),sum:l.sum+r.sum};}
for(let i=0;i<256;i++)empty.push(branch(empty[i],empty[i]));
const stakes=[0n,0n,0n];
function tree(){let level=new Map(stakes.map((s,i)=>[BigInt(i+1),{hash:H(Buffer.concat([Buffer.from([1]),W(i+1),W(s)])),sum:s}]));const levels=[level];for(let h=0;h<256;h++){const next=new Map();for(const i of level.keys()){const p=i>>1n;if(!next.has(p))next.set(p,branch(level.get(p*2n)??empty[h],level.get(p*2n+1n)??empty[h]));}level=next;levels.push(level);}const n=level.get(0n);return {root:H(Buffer.concat([Buffer.from('CAW_STAKE_TREE_RESEARCH_V1\0'),Buffer.alloc(32,0x11),n.hash,W(n.sum)])),proof(id){let i=BigInt(id);return Array.from({length:256},(_,h)=>{const x=levels[h].get(i^1n)??empty[h];i>>=1n;return x;});}};}
token=await create('MockTokenResearch');
await create(cname,abi([BigInt(A.toString()),BigInt(A.toString()),BigInt(A.toString()),BigInt(B.toString())]),'TOKEN_CODE');
await create(cname,abi([BigInt(token.toString()),0,BigInt(A.toString()),BigInt(B.toString())]),'ZERO_OWNER');
vault=await create(cname,abi([BigInt(token.toString()),BigInt(A.toString()),BigInt(A.toString()),BigInt(B.toString())]));
assert.equal(await get(vault,'root'),BigInt('0x'+hex(tree().root)));const initial=await state();invariant(initial);assert.equal(initial.liabilities,'0');
const unit=10n**18n,F=5000n*unit;
await call(token,'mint',[BigInt(A.toString()),6010n*unit]);await call(token,'mint',[BigInt(B.toString()),10n*unit]);
await call(vault,'deposit',[1,0,6000n*unit],A,'ALLOWANCE');assert.deepEqual(await state(),initial);
await call(token,'approve',[BigInt(vault.toString()),6010n*unit]);await call(token,'approve',[BigInt(vault.toString()),10n*unit],B);
await call(vault,'deposit',[1,0,6000n*unit]);await call(vault,'deposit',[2,0,10n*unit]);await call(vault,'deposit',[3,0,10n*unit],B);
for(const [id,amount]of [[1,1000n*unit],[2,3n*unit],[3,8n*unit]]){const proof=tree().proof(id);const data=Buffer.concat([selector(cname,'changeStake'),abi([id,0,1,amount,0]),...proof.map(n=>Buffer.concat([n.hash,W(n.sum)]))]);await call(vault,'changeStake',[],id===3?B:A,undefined,data);stakes[id-1]=amount;assert.equal(await get(vault,'root'),BigInt('0x'+hex(tree().root)));invariant(await state());}
const text=Buffer.from('one normally initialized action','utf8');const root=await get(vault,'root');
const req=[1n,0n,0n,10n,20n,root,BigInt('0x'+hex(K(text)))];
const digest=(await call(vault,'postDigest',req)).returnValue;
const sig=Buffer.from(secp256k1.sign(digest,W(1),{prehash:false,format:'recovered'}));const signature=Buffer.concat([sig.subarray(1),Buffer.from([27+sig[0]])]);
const sigTail=Buffer.concat([W(65),signature,Buffer.alloc(31)]);const textTail=Buffer.concat([W(text.length),text,Buffer.alloc((32-text.length%32)%32)]);
const data=Buffer.concat([selector(cname,'settleFixedPool1'),abi([...req,288,288+sigTail.length]),sigTail,textTail]);

const baseline=variant==='Baseline.sol';
// Mint/approve before arming so only the tested custody call triggers the callback.
if(action==='deposit'){await call(token,'mint',[BigInt(A.toString()),unit]);await call(token,'approve',[BigInt(vault.toString()),unit]);}
const configure=async armed=>{const tail=Buffer.concat([W(data.length),data,Buffer.alloc((32-data.length%32)%32)]);const raw=Buffer.concat([selector('MockTokenResearch','configure'),abi([BigInt(vault.toString()),96,armed?1:0]),tail]);await call(token,'configure',[],A,undefined,raw);};
await configure(true);
const before=await state();await call(vault,action,[2,0,unit]);const after=await state();invariant(after);
assert.equal(await get(token,'callbackAccepted'),baseline?1n:0n);assert.equal(after.nonce,baseline?'1':'0');
const delta=action==='deposit'?unit:-unit,share2=F*3n/11n,share3=F*8n/11n;
assert.equal(BigInt(after.credit1),BigInt(before.credit1)-(baseline?F:0n));
assert.equal(BigInt(after.credit2),BigInt(before.credit2)+delta+(baseline?share2:0n));
assert.equal(BigInt(after.credit3),BigInt(before.credit3)+(baseline?share3:0n));
assert.equal(after.root,before.root);assert.equal(after.owner2,before.owner2);assert.equal(after.epoch2,before.epoch2);
if(!baseline){
 const encoded=(await call(token,'callbackResult')).returnValue;const length=Number(BigInt('0x'+hex(encoded.subarray(32,64))));assert.equal(reason(encoded.subarray(64,64+length)),'REENTRY');
 await configure(false);await call(vault,'settleFixedPool1',[],relay,undefined,data);assert.equal((await state()).nonce,'1');invariant(await state());
 const final=await state();await call(vault,'settleFixedPool1',[],relay,'NONCE',data);assert.deepEqual(await state(),final);
}
const report={variant,action,nestedSettlementAccepted:baseline,outerCustodyPassed:true,ledgerAndBackingMatched:true,standaloneSettlementPassed:!baseline,replayedIntentRejected:!baseline,vaultSourceHash,compiler:solc.version(),scope:'creation/call-level EVM with signed application intent, not signed Ethereum transactions',theftDemonstrated:false};
save('result.json',report);return report;
}
const rows=[];for(const variant of ['Baseline.sol','DeployedCustodyStakeResearch.sol'])for(const action of ['deposit','withdraw'])rows.push(await scenario(variant,action));fs.writeFileSync(parent+'/result.json',JSON.stringify({schema:'caw-settlement-callback/1',rows},null,2)+'\n');console.log(JSON.stringify(rows));
