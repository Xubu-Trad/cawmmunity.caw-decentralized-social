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
  if(action==='withdraw'){await config(false);await call(token,tokenCode,'deposit');}
  await config(true);await call(token,tokenCode,action);
  const accepted=BigInt('0x'+hex(await call(token,tokenCode,'callbackAccepted')))!==0n;
  const baseline=variant==='Baseline.sol';assert.equal(accepted,baseline);
  assert.equal(await get('owner2'),BigInt((baseline?B:token).toString()));assert.equal(await get('epoch2'),baseline?1n:0n);
  assert.equal(await get('credit2'),action==='deposit'?100n:90n);assert.equal(await get('liabilities'),await get('credit2'));
  const balance=BigInt('0x'+hex(await call(token,tokenCode,'balanceOf',[BigInt(vault.toString())])));assert.equal(balance,await get('liabilities'));
  if(!baseline){
   const encoded=await call(token,tokenCode,'callbackResult');const length=Number(BigInt('0x'+hex(encoded.subarray(32,64))));const reason=encoded.subarray(64,64+length);assert.equal(hex(reason.subarray(0,4)),'08c379a0');assert.equal(reason.subarray(68,75).toString(),'REENTRY');
   await config(false);await call(token,tokenCode,'transferOutside');assert.equal(await get('owner2'),BigInt(B.toString()));assert.equal(await get('epoch2'),1n);
  }
  rows.push({variant,action,nestedTransferAccepted:accepted,outerOperationCompleted:true,creditAndBackingMatched:true,standaloneTransferPassed:!baseline});
 }
}
const result={schema:'caw-owner-callback-regression/1',rows,compiler:solc.version(),sourceHashes:Object.fromEntries(['Baseline.sol','DeployedCustodyStakeResearch.sol','CallbackToken.sol'].map(n=>[n,crypto.createHash('sha256').update(fs.readFileSync(new URL(n,import.meta.url))).digest('hex')])),scope:'local EVM creation/calls; not signed transaction or public-chain proof',maliciousTokenRequired:true,contractOwnerFixture:true,theftDemonstrated:false};
fs.writeFileSync(out+'/result.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
