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
const tokenSource=fs.readFileSync(new URL('./FailureTokenFixture.sol',import.meta.url),'utf8');
const input={language:'Solidity',sources:{'DeployedCustodyStakeResearch.sol':{content:source},'FailureTokenFixture.sol':{content:tokenSource}},settings:{optimizer:{enabled:true,runs:200},evmVersion:'shanghai',outputSelection:{'*':{'*':['abi','evm.bytecode.object','evm.deployedBytecode.object','evm.methodIdentifiers']}}}};
assert(solc.version().startsWith('0.8.30+'));save('compiler-input.json',input);
const compiled=JSON.parse(solc.compile(JSON.stringify(input)));save('compiler-output.json',compiled);
assert(!(compiled.errors??[]).some(x=>x.severity==='error'),JSON.stringify(compiled.errors));
const contracts={...compiled.contracts['DeployedCustodyStakeResearch.sol'],...compiled.contracts['FailureTokenFixture.sol']};
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
 const type=to===token?'FailureTokenFixture':cname;
 const data=raw??Buffer.concat([selector(type,name),abi(args)]);
 const r=(await evm.runCall({caller,to,data,gasLimit:500000n,block:{header:{number:1n,coinbase:relay,timestamp:15n,difficulty:0n,prevRandao:new Uint8Array(32),gasLimit:30000000n,baseFeePerGas:undefined,slotNumber:0n,getBlobGasPrice:()=>undefined}}})).execResult;
 if(expected){assert.equal(r.exceptionError?.error,'revert',name);if(expected==='EMPTY_REVERT')assert.equal(r.returnValue.length,0,name);else assert.equal(reason(r.returnValue),expected,name);assert.equal((r.logs??[]).length,0);}
 else assert.equal(r.exceptionError,undefined,name);
 rows.push({name,caller:caller.toString(),to:to.toString(),expected:expected??'OK',calldata:'0x'+hex(data),gas:r.executionGasUsed,logs:(r.logs??[]).map(([a,t,d])=>({address:hex(a),topics:t.map(hex),data:hex(d)}))});return r;
}
async function get(to,name,args=[]){const type=to===token?'FailureTokenFixture':cname;const r=(await evm.runCall({caller:A,to,data:Buffer.concat([selector(type,name),abi(args)]),gasLimit:300000n})).execResult;assert.equal(r.exceptionError,undefined);return BigInt('0x'+hex(r.returnValue));}
async function state(){const s={};for(const k of ['root','totalStake','liabilities','poolDust','credit1','credit2','credit3','stake1','stake2','stake3','owner1','owner2','owner3','epoch1','epoch2','epoch3'])s[k]=String(await get(vault,k));s.nonce=String(await get(vault,'postNonces',[1]));s.balance=String(await get(token,'rawBalance',[BigInt(vault.toString())]));return s;}
function invariant(s){assert.equal(BigInt(s.liabilities),BigInt(s.credit1)+BigInt(s.credit2)+BigInt(s.credit3));assert.equal(BigInt(s.balance),BigInt(s.liabilities)+BigInt(s.poolDust));assert.equal(BigInt(s.totalStake),BigInt(s.stake1)+BigInt(s.stake2)+BigInt(s.stake3));for(let i=1;i<=3;i++)assert(BigInt(s['stake'+i])<=BigInt(s['credit'+i]));}


async function setup(){token=await create('FailureTokenFixture');vault=await create(cname,abi([BigInt(token.toString()),BigInt(A.toString()),BigInt(A.toString()),BigInt(B.toString())]));await call(token,'mint',[BigInt(A.toString()),1000]);await call(token,'approve',[BigInt(vault.toString()),1000]);}
async function snapshot(){return {account:await state(),wallet:String(await get(token,'rawBalance',[BigInt(A.toString())])),allowance:String(await get(token,'allowance',[BigInt(A.toString()),BigInt(vault.toString())])),touched:String(await get(token,'touched'))};}
await setup();const cases=[];
for(const mode of [12,13]){
 await call(token,'setMode',[mode]);const before=await snapshot();await call(vault,'deposit',[1,0,100],A,'EMPTY_REVERT');assert.deepEqual(await snapshot(),before);cases.push({mode,operation:'deposit',rollback:true});
 await call(token,'setMode',[0]);await call(vault,'deposit',[1,0,100]);await call(token,'setMode',[mode]);const funded=await snapshot();await call(vault,'withdraw',[1,0,100],A,'EMPTY_REVERT');assert.deepEqual(await snapshot(),funded);cases.push({mode,operation:'withdraw',rollback:true});
 await call(token,'setMode',[0]);await call(vault,'withdraw',[1,0,100]);assert.equal((await snapshot()).wallet,'1000');
}
// Negative evidence: a token can make its reports consistent without moving its ledger.
await setup();await call(token,'setMode',[14]);await call(vault,'deposit',[1,0,100]);
const fakeDeposit=await snapshot();assert.equal(fakeDeposit.account.credit1,'100');assert.equal(fakeDeposit.account.balance,'0');assert.equal(fakeDeposit.wallet,'1000');
assert.equal(await get(token,'balanceOf',[BigInt(vault.toString())]),100n);
await setup();await call(vault,'deposit',[1,0,100]);await call(token,'setMode',[14]);await call(vault,'withdraw',[1,0,100]);
const fakeWithdrawal=await snapshot();assert.equal(fakeWithdrawal.account.credit1,'0');assert.equal(fakeWithdrawal.account.balance,'100');assert.equal(fakeWithdrawal.wallet,'900');
assert.equal(await get(token,'balanceOf',[BigInt(A.toString())]),1000n);
save('results.json',{schema:'caw-token-trust-boundary/1',sourceSha256:hex(H(Buffer.from(source))),tokenSha256:hex(H(Buffer.from(tokenSource))),gasLimitPerCall:500000,cases,recoveryCycles:2,fakeDeposit,fakeWithdrawal,misleadingReportsAccepted:true,signedEthereumTransactions:false,productionTokenFinding:false,rows});
console.log(JSON.stringify({gasFailureCases:4,recoveryCycles:2,negativeFinding:'consistent false balance reports accepted; actual fixture ledger did not transfer'}));
