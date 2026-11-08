// Signed local Anvil transactions. Synthetic funded genesis; no live network.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import solc from 'solc';
import {keccak_256} from '@noble/hashes/sha3.js';
import {secp256k1} from '@noble/curves/secp256k1.js';
import {createAddressFromPrivateKey} from '@ethereumjs/util';
import {Common,Hardfork,Mainnet} from '@ethereumjs/common';
import {Wallet, Transaction} from 'ethers';

const out=process.argv[2];assert(out&&!fs.existsSync(out));fs.mkdirSync(out);
const save=(n,v)=>fs.writeFileSync(`${out}/${n}`,JSON.stringify(v,(_,x)=>typeof x==='bigint'?x.toString():x,2)+'\n');
const source=fs.readFileSync(new URL('./DeployedCustodyStakeResearch.sol',import.meta.url),'utf8');
const input={language:'Solidity',sources:{'DeployedCustodyStakeResearch.sol':{content:source}},settings:{optimizer:{enabled:true,runs:200},evmVersion:'shanghai',outputSelection:{'*':{'*':['abi','evm.bytecode.object','evm.deployedBytecode.object','evm.methodIdentifiers']}}}};
assert(solc.version().startsWith('0.8.30+'));save('compiler-input.json',input);
const compiled=JSON.parse(solc.compile(JSON.stringify(input)));save('compiler-output.json',compiled);
assert(!(compiled.errors??[]).some(x=>x.severity==='error'),JSON.stringify(compiled.errors));
const contracts=compiled.contracts['DeployedCustodyStakeResearch.sol'];
const W=x=>Buffer.from(BigInt(x).toString(16).padStart(64,'0'),'hex');
const hex=b=>Buffer.from(b).toString('hex');const K=b=>Buffer.from(keccak_256(b));
const H=b=>crypto.createHash('sha256').update(b).digest();const abi=xs=>Buffer.concat(xs.map(W));
const A=createAddressFromPrivateKey(W(1)),B=createAddressFromPrivateKey(W(2)),relay=createAddressFromPrivateKey(W(3));
const rpcUrl=process.argv[3];assert(/^http:\/\/127\.0\.0\.1:\d+$/.test(rpcUrl));
const networkRecords=[];let rpcId=0;
async function rpc(method,params){const response=await fetch(rpcUrl,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:++rpcId,method,params})});const j=await response.json();if(j.error){const e=new Error(j.error.message);e.rpc=j.error;throw e;}return j.result;}
assert.equal(await rpc('eth_chainId',[]),'0x7a69');
const wallets=new Map([1,2,3].map(k=>{const w=new Wallet('0x'+hex(W(k)));return [w.address.toLowerCase(),w];}));
const viewSelectors=new Set(Object.values(contracts).flatMap(c=>Object.entries(c.evm.methodIdentifiers).filter(([signature])=>c.abi.some(a=>a.type==='function'&&a.name===signature.split('(')[0]&&['view','pure'].includes(a.stateMutability))).map(([,selector])=>selector)));
const evm={stateManager:{async getCode(address){return Buffer.from((await rpc('eth_getCode',[address.toString(),'latest'])).slice(2),'hex');}},async runCall({caller,to,data,gasLimit}){
 const from=caller.toString(),request={from,data:'0x'+hex(data),gas:'0x'+gasLimit.toString(16)};if(to)request.to=to.toString();
 if(to&&viewSelectors.has(hex(data.subarray(0,4)))){const v=await rpc('eth_call',[request,'latest']);return {execResult:{returnValue:Buffer.from(v.slice(2),'hex'),executionGasUsed:0n}};}
 let revertData;try{await rpc('eth_call',[request,'latest']);}catch(e){revertData=e.rpc?.data;assert(typeof revertData==='string'&&revertData.startsWith('0x'),JSON.stringify(e.rpc));}
 const nonce=BigInt(await rpc('eth_getTransactionCount',[from,'pending']));const wallet=wallets.get(from.toLowerCase());assert(wallet);
 const raw=await wallet.signTransaction({type:0,chainId:31337,nonce:Number(nonce),gasLimit,gasPrice:2000000000n,to:to?.toString(),data:request.data,value:0});
 const decoded=Transaction.from(raw);assert.equal(decoded.from.toLowerCase(),from.toLowerCase());assert.equal(decoded.chainId,31337n);
 const txHash=await rpc('eth_sendRawTransaction',[raw]);assert.equal(txHash,'0x'+hex(K(Buffer.from(raw.slice(2),'hex'))));
 let receipt;for(let i=0;i<100;i++){receipt=await rpc('eth_getTransactionReceipt',[txHash]);if(receipt)break;await new Promise(r=>setTimeout(r,20));}assert(receipt);
 const fetched=await rpc('eth_getTransactionByHash',[txHash]);assert.equal(fetched.from.toLowerCase(),from.toLowerCase());assert.equal(fetched.input,request.data);assert.equal(receipt.transactionHash,txHash);
 const failed=receipt.status==='0x0';if(failed)assert(revertData,'missing independently queried revert data');else assert.equal(revertData,undefined);
 networkRecords.push({rawTransaction:raw,transaction:fetched,receipt,preflightRevertData:revertData??null});
 return {createdAddress:receipt.contractAddress?{toString:()=>receipt.contractAddress}:undefined,execResult:{exceptionError:failed?{error:'revert'}:undefined,returnValue:failed?Buffer.from(revertData.slice(2),'hex'):Buffer.alloc(0),executionGasUsed:BigInt(receipt.gasUsed),logs:receipt.logs.map(l=>[Buffer.from(l.address.slice(2),'hex'),l.topics.map(t=>Buffer.from(t.slice(2),'hex')),Buffer.from(l.data.slice(2),'hex')])}};
}};
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
const req=[1n,0n,0n,0n,18446744073709551615n,root,BigInt('0x'+hex(K(text)))];
const digest=(await call(vault,'postDigest',req)).returnValue;
const sig=Buffer.from(secp256k1.sign(digest,W(1),{prehash:false,format:'recovered'}));const signature=Buffer.concat([sig.subarray(1),Buffer.from([27+sig[0]])]);
const sigTail=Buffer.concat([W(65),signature,Buffer.alloc(31)]);const textTail=Buffer.concat([W(text.length),text,Buffer.alloc((32-text.length%32)%32)]);
const data=Buffer.concat([selector(cname,'settleFixedPool1'),abi([...req,288,288+sigTail.length]),sigTail,textTail]);
const before=await state();await call(vault,'settleFixedPool1',[],relay,undefined,data);const after=await state();invariant(after);assert.equal(BigInt(before.credit1)-BigInt(after.credit1),F);assert.equal(after.nonce,'1');
const share2=F*3n/11n,share3=F*8n/11n;assert.equal(BigInt(after.credit2)-BigInt(before.credit2),share2);assert.equal(BigInt(after.credit3)-BigInt(before.credit3),share3);
const settled=rows.at(-1);assert.equal(settled.logs.length,2);const encoded=Buffer.from(settled.logs[1].data,'hex');assert.deepEqual(encoded.subarray(64,64+text.length),text);
await call(vault,'settleFixedPool1',[],relay,'NONCE',data);assert.deepEqual(await state(),after);
await call(vault,'withdraw',[2,0,share2],B,'OWNER');assert.deepEqual(await state(),after);
await call(vault,'transferAccount',[2,0,BigInt(B.toString())]);
const transferred=await state();await call(vault,'withdraw',[2,0,share2],A,'OWNER');assert.deepEqual(await state(),transferred);
await call(vault,'withdraw',[2,0,share2],B,'EPOCH');assert.deepEqual(await state(),transferred);
const walletBefore=await get(token,'balanceOf',[BigInt(B.toString())]);await call(vault,'withdraw',[2,1,share2],B);await call(vault,'withdraw',[3,0,share3],B);
assert.equal((await get(token,'balanceOf',[BigInt(B.toString())]))-walletBefore,share2+share3);
// Returning to the original owner must not resurrect a queued old-epoch intent.
const next=[...req];next[2]=1n;
const nextDigest=(await call(vault,'postDigest',next)).returnValue;
const nextSig=Buffer.from(secp256k1.sign(nextDigest,W(1),{prehash:false,format:'recovered'}));
const nextTail=Buffer.concat([W(65),nextSig.subarray(1),Buffer.from([27+nextSig[0]]),Buffer.alloc(31)]);
const nextData=Buffer.concat([selector(cname,'settleFixedPool1'),abi([...next,288,288+nextTail.length]),nextTail,textTail]);
await call(vault,'transferAccount',[1,0,BigInt(B.toString())]);
await call(vault,'transferAccount',[1,1,BigInt(A.toString())],B);
const returned=await state();await call(vault,'settleFixedPool1',[],relay,'EPOCH',nextData);assert.deepEqual(await state(),returned);
const final=await state();invariant(final);
save('results.json',{schema:'caw-signed-local-lifecycle-research/1',sourceSha256:hex(H(Buffer.from(source))),compiler:solc.version(),node:process.version,initial,before,after,final,rows,constructorExecuted:true,directCodeOrStorageWrites:false,signedPublicAction:true,signedEthereumTransactions:true,networkRecords,realNft:false,realToken:false,policyAdopted:false});
save('network-records.json',networkRecords); console.log('SIGNED_LOCAL_TRANSACTIONS='+networkRecords.length+' PASS');
