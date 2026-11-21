import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import solc from 'solc';
import {createEVM} from '@ethereumjs/evm';
import {Common,Mainnet,Hardfork} from '@ethereumjs/common';
import {createAddressFromPrivateKey} from '@ethereumjs/util';
const out=process.argv[2];assert(out&&!fs.existsSync(out));fs.mkdirSync(out);
const W=x=>Buffer.from(BigInt(x).toString(16).padStart(64,'0'),'hex');
const abi=xs=>Buffer.concat(xs.map(W)),hex=x=>Buffer.from(x).toString('hex');
const A=createAddressFromPrivateKey(W(1)),B=createAddressFromPrivateKey(W(2));
const H=b=>crypto.createHash('sha256').update(b).digest();
const empty=[{hash:H(Buffer.from([0])),sum:0n}];
const branch=(l,r)=>({hash:H(Buffer.concat([Buffer.from([2]),l.hash,W(l.sum),r.hash,W(r.sum)])),sum:l.sum+r.sum});
for(let i=0;i<256;i++)empty.push(branch(empty[i],empty[i]));
let level=new Map([1n,2n,3n].map(id=>[id,{hash:H(Buffer.concat([Buffer.from([1]),W(id),W(0)])),sum:0n}]));
const proof=[];let index=2n;
for(let height=0;height<256;height++){proof.push(level.get(index^1n)??empty[height]);const next=new Map();for(const id of level.keys()){const p=id>>1n;if(!next.has(p))next.set(p,branch(level.get(p*2n)??empty[height],level.get(p*2n+1n)??empty[height]));}level=next;index>>=1n;}
const rows=[];
for(const variant of ['Baseline.sol','DeployedCustodyStakeResearch.sol']){
 const source=fs.readFileSync(new URL(variant,import.meta.url),'utf8');
 const input={language:'Solidity',sources:{'Vault.sol':{content:source},'CallbackToken.sol':{content:fs.readFileSync(new URL('CallbackToken.sol',import.meta.url),'utf8')}},settings:{optimizer:{enabled:true,runs:200},evmVersion:'shanghai',outputSelection:{'*':{'*':['evm.bytecode.object','evm.methodIdentifiers']}}}};
 const compiled=JSON.parse(solc.compile(JSON.stringify(input)));assert(!(compiled.errors??[]).some(e=>e.severity==='error'),JSON.stringify(compiled.errors));
 fs.writeFileSync(out+'/'+variant+'.compiler.json',JSON.stringify(compiled));
 const vaultCode=compiled.contracts['Vault.sol'].DeployedCustodyStakeResearch,tokenCode=compiled.contracts['CallbackToken.sol'].CallbackToken;
 for(const action of ['deposit','withdraw']){
  const evm=await createEVM({common:new Common({chain:Mainnet,hardfork:Hardfork.Shanghai})});
  async function create(code,args=[]){const r=await evm.runCall({caller:A,data:Buffer.concat([Buffer.from(code.evm.bytecode.object,'hex'),abi(args)]),gasLimit:15000000n});assert.equal(r.execResult.exceptionError,undefined);return r.createdAddress;}
  async function call(to,code,name,args=[]){const s=Object.entries(code.evm.methodIdentifiers).filter(([k])=>k.startsWith(name+'('));assert.equal(s.length,1);const r=(await evm.runCall({caller:A,to,data:Buffer.concat([Buffer.from(s[0][1],'hex'),abi(args)]),gasLimit:10000000n})).execResult;assert.equal(r.exceptionError,undefined,name);return Buffer.from(r.returnValue);}
  const token=await create(tokenCode),vault=await create(vaultCode,[BigInt(token.toString()),BigInt(A.toString()),BigInt(token.toString()),BigInt(B.toString())]);
  const config=armed=>call(token,tokenCode,'configure',[BigInt(vault.toString()),BigInt(B.toString()),armed?1:0]);
  const get=async(name)=>BigInt('0x'+hex(await call(vault,vaultCode,name)));
    await config(false);await call(token,tokenCode,'deposit');
  const rootBefore=await get('root');
  const sig=Object.entries(vaultCode.evm.methodIdentifiers).find(([k])=>k.startsWith('changeStake('))[1];
  const payload=Buffer.concat([Buffer.from(sig,'hex'),abi([2,0,1,1,0]),...proof.map(n=>Buffer.concat([n.hash,W(n.sum)]))]);
  const tail=Buffer.concat([W(32),W(payload.length),payload,Buffer.alloc((32-payload.length%32)%32)]);
  const setSig=tokenCode.evm.methodIdentifiers['setPayload(bytes)'];
  const configured=(await evm.runCall({caller:A,to:token,data:Buffer.concat([Buffer.from(setSig,'hex'),tail]),gasLimit:20000000n})).execResult;assert.equal(configured.exceptionError,undefined);
  await config(true);await call(token,tokenCode,action);
  const accepted=BigInt('0x'+hex(await call(token,tokenCode,'callbackAccepted')))!==0n;
  const baseline=variant==='Baseline.sol';assert.equal(accepted,baseline);
  assert.equal(await get('owner2'),BigInt(token.toString()));assert.equal(await get('epoch2'),0n);assert.equal(await get('stake2'),baseline?1n:0n);assert.equal(await get('totalStake'),baseline?1n:0n);assert.equal((await get('root'))===rootBefore,!baseline);
  assert.equal(await get('credit2'),action==='deposit'?200n:90n);assert.equal(await get('liabilities'),await get('credit2'));
  const balance=BigInt('0x'+hex(await call(token,tokenCode,'balanceOf',[BigInt(vault.toString())])));assert.equal(balance,await get('liabilities'));
  if(!baseline){
   const encoded=await call(token,tokenCode,'callbackResult');const length=Number(BigInt('0x'+hex(encoded.subarray(32,64))));const reason=encoded.subarray(64,64+length);assert.equal(hex(reason.subarray(0,4)),'08c379a0');assert.equal(reason.subarray(68,75).toString(),'REENTRY');
   await config(false);await call(token,tokenCode,'runPayload');assert.equal(await get('stake2'),1n);assert.equal(await get('totalStake'),1n);assert.notEqual(await get('root'),rootBefore);
  }
  rows.push({variant,action,nestedStakeAccepted:accepted,outerOperationCompleted:true,creditAndBackingMatched:true,standaloneStakePassed:!baseline});
 }
}
const result={schema:'caw-stake-callback-regression/1',rows,compiler:solc.version(),sourceHashes:Object.fromEntries(['Baseline.sol','DeployedCustodyStakeResearch.sol','CallbackToken.sol'].map(n=>[n,crypto.createHash('sha256').update(fs.readFileSync(new URL(n,import.meta.url))).digest('hex')])),scope:'local EVM creation/calls; not signed transaction or public-chain proof',maliciousTokenRequired:true,contractOwnerFixture:true,theftDemonstrated:false};
fs.writeFileSync(out+'/result.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
