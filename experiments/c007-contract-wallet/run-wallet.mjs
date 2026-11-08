import fs from 'node:fs';import assert from 'node:assert/strict';import crypto from 'node:crypto';import solc from 'solc';
import {createEVM} from '@ethereumjs/evm';import {Common,Mainnet,Hardfork} from '@ethereumjs/common';import {createAddressFromPrivateKey} from '@ethereumjs/util';import {keccak_256} from '@noble/hashes/sha3.js';
const out=process.argv[2];assert(out&&!fs.existsSync(out));fs.mkdirSync(out);
const files=['DeployedCustodyStakeResearch.sol','WalletValidationFixture.sol'];const sources=Object.fromEntries(files.map(n=>[n,{content:fs.readFileSync(new URL(n,import.meta.url),'utf8')}]));
const input={language:'Solidity',sources,settings:{optimizer:{enabled:true,runs:200},evmVersion:'shanghai',outputSelection:{'*':{'*':['evm.bytecode.object','evm.methodIdentifiers']}}}};
const compiled=JSON.parse(solc.compile(JSON.stringify(input)));assert(!(compiled.errors??[]).some(x=>x.severity==='error'),JSON.stringify(compiled.errors));fs.writeFileSync(out+'/compiler-input.json',JSON.stringify(input));fs.writeFileSync(out+'/compiler-output.json',JSON.stringify(compiled));
const vaultCode=compiled.contracts[files[0]].DeployedCustodyStakeResearch,tokenCode=compiled.contracts[files[0]].MockTokenResearch,walletCode=compiled.contracts[files[1]].WalletValidationFixture;
const W=x=>Buffer.from(BigInt(x).toString(16).padStart(64,'0'),'hex'),abi=xs=>Buffer.concat(xs.map(W)),hex=b=>Buffer.from(b).toString('hex');const A=createAddressFromPrivateKey(W(1));
const evm=await createEVM({common:new Common({chain:Mainnet,hardfork:Hardfork.Shanghai})});
const selector=(code,name)=>Buffer.from(Object.entries(code.evm.methodIdentifiers).find(([k])=>k.startsWith(name+'('))[1],'hex');
async function deploy(code,args=[]){const r=await evm.runCall({caller:A,data:Buffer.concat([Buffer.from(code.evm.bytecode.object,'hex'),abi(args)]),gasLimit:15000000n});assert.equal(r.execResult.exceptionError,undefined);return r.createdAddress;}
async function call(to,code,name,args=[],raw){return (await evm.runCall({caller:A,to,data:raw??Buffer.concat([selector(code,name),abi(args)]),gasLimit:3000000n})).execResult;}
function reason(v){const b=Buffer.from(v);assert.equal(hex(b.subarray(0,4)),'08c379a0');return b.subarray(68,68+Number(BigInt('0x'+hex(b.subarray(36,68))))).toString();}
const token=await deploy(tokenCode),wallet=await deploy(walletCode),vault=await deploy(vaultCode,[BigInt(token.toString()),BigInt(wallet.toString()),BigInt(A.toString()),BigInt(A.toString())]);
const root=BigInt('0x'+hex((await call(vault,vaultCode,'root')).returnValue));const req=[1n,0n,0n,0n,100n,root,0n];
const digest=(await call(vault,vaultCode,'postDigest',req)).returnValue;const results=[];
async function configure(sig,mode){const r=await call(wallet,walletCode,'configure',[BigInt('0x'+hex(digest)),BigInt('0x'+hex(keccak_256(sig))),mode]);assert.equal(r.exceptionError,undefined);}
async function verify(name,sig,expected,request=req,entry='verifyPost'){
 const raw=Buffer.concat([selector(vaultCode,entry),abi([...request,256]),W(sig.length),sig,Buffer.alloc((32-sig.length%32)%32)]);const r=await call(vault,vaultCode,entry,[],raw);
 if(expected){assert.equal(r.exceptionError?.error,'revert',name);assert.equal(reason(r.returnValue),expected,name);}else{assert.equal(r.exceptionError,undefined,name);assert.equal(BigInt('0x'+hex(r.returnValue)),1n);}
 results.push({name,result:expected??'accepted'});
}
const sig=Buffer.from('aabbcc','hex');await configure(sig,0);await verify('valid_wallet',sig);await verify('direct_eoa_entry_rejects_contract',Buffer.alloc(65),'OWNER_CODE',req,'verifyPostEOA');
for(const [mode,label]of [[1,'bad_magic'],[2,'wallet_revert'],[3,'short_return'],[4,'empty_return'],[5,'static_write'],[6,'gas_exhaustion']]){await configure(sig,mode);await verify(label,sig,'WALLET_SIGNATURE');}
assert.equal(BigInt('0x'+hex((await call(wallet,walletCode,'writes')).returnValue)),0n);
await configure(sig,7);await verify('large_return_bounded_copy',sig);
await configure(sig,0);await verify('changed_signature',Buffer.from('aabbcd','hex'),'WALLET_SIGNATURE');const wrong=[...req];wrong[2]=1n;await verify('changed_digest',sig,'WALLET_SIGNATURE',wrong);
const stale=[...req];stale[1]=1n;await verify('stale_epoch',sig,'EPOCH',stale);const badRoot=[...req];badRoot[5]=0n;await verify('wrong_root',sig,'ROOT',badRoot);
const limit=Buffer.alloc(4096,1);await configure(limit,0);await verify('signature_limit_accepts',limit);await verify('signature_over_limit',Buffer.alloc(4097,1),'SIGNATURE_LIMIT');
await configure(sig,0);await verify('restored_wallet_mode',sig);
const report={schema:'caw-contract-wallet-adapter/1',passed:results.length,results,compiler:solc.version(),sourceSha256:crypto.createHash('sha256').update(sources[files[0]].content).digest('hex'),profile:{gas:100000,maxSignatureBytes:4096,minReturnBytes:32,copiedReturnBytes:32},stateWritesRejected:true,scope:'local deployed validation calls; not complete contract-wallet settlement or EIP-7702',productionWallet:false};fs.writeFileSync(out+'/result.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
