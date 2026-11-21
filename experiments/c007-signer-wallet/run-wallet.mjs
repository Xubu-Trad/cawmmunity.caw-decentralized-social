import {secp256k1} from '@noble/curves/secp256k1.js';
import fs from 'node:fs';import assert from 'node:assert/strict';import crypto from 'node:crypto';import solc from 'solc';
import {createEVM} from '@ethereumjs/evm';import {Common,Mainnet,Hardfork} from '@ethereumjs/common';import {createAddressFromPrivateKey} from '@ethereumjs/util';import {keccak_256} from '@noble/hashes/sha3.js';
const out=process.argv[2];assert(out&&!fs.existsSync(out));fs.mkdirSync(out);
const files=['DeployedCustodyStakeResearch.sol','SignerWalletFixture.sol'];const sources=Object.fromEntries(files.map(n=>[n,{content:fs.readFileSync(new URL(n,import.meta.url),'utf8')}]));
const input={language:'Solidity',sources,settings:{optimizer:{enabled:true,runs:200},evmVersion:'shanghai',outputSelection:{'*':{'*':['evm.bytecode.object','evm.methodIdentifiers']}}}};
const compiled=JSON.parse(solc.compile(JSON.stringify(input)));assert(!(compiled.errors??[]).some(x=>x.severity==='error'),JSON.stringify(compiled.errors));fs.writeFileSync(out+'/compiler-input.json',JSON.stringify(input));fs.writeFileSync(out+'/compiler-output.json',JSON.stringify(compiled));
const vaultCode=compiled.contracts[files[0]].DeployedCustodyStakeResearch,tokenCode=compiled.contracts[files[0]].MockTokenResearch,walletCode=compiled.contracts[files[1]].SignerWalletFixture;
const W=x=>Buffer.from(BigInt(x).toString(16).padStart(64,'0'),'hex'),abi=xs=>Buffer.concat(xs.map(W)),hex=b=>Buffer.from(b).toString('hex');const A=createAddressFromPrivateKey(W(1));
const evm=await createEVM({common:new Common({chain:Mainnet,hardfork:Hardfork.Shanghai})});
const selector=(code,name)=>Buffer.from(Object.entries(code.evm.methodIdentifiers).find(([k])=>k.startsWith(name+'('))[1],'hex');
async function deploy(code,args=[]){const r=await evm.runCall({caller:A,data:Buffer.concat([Buffer.from(code.evm.bytecode.object,'hex'),abi(args)]),gasLimit:15000000n});assert.equal(r.execResult.exceptionError,undefined);return r.createdAddress;}
async function call(to,code,name,args=[],raw){return (await evm.runCall({caller:A,to,data:raw??Buffer.concat([selector(code,name),abi(args)]),gasLimit:3000000n})).execResult;}
function reason(v){const b=Buffer.from(v);assert.equal(hex(b.subarray(0,4)),'08c379a0');return b.subarray(68,68+Number(BigInt('0x'+hex(b.subarray(36,68))))).toString();}
const token=await deploy(tokenCode),wallet=await deploy(walletCode,[BigInt(A.toString())]),vault=await deploy(vaultCode,[BigInt(token.toString()),BigInt(wallet.toString()),BigInt(A.toString()),BigInt(A.toString())]);
const root=BigInt('0x'+hex((await call(vault,vaultCode,'root')).returnValue));const req=[1n,0n,0n,0n,100n,root,0n];
const digest=(await call(vault,vaultCode,'postDigest',req)).returnValue;const results=[];
async function verify(name,sig,expected,request=req,entry='verifyPost'){
 const raw=Buffer.concat([selector(vaultCode,entry),abi([...request,256]),W(sig.length),sig,Buffer.alloc((32-sig.length%32)%32)]);const r=await call(vault,vaultCode,entry,[],raw);
 if(expected){assert.equal(r.exceptionError?.error,'revert',name);assert.equal(reason(r.returnValue),expected,name);}else{assert.equal(r.exceptionError,undefined,name);assert.equal(BigInt('0x'+hex(r.returnValue)),1n);}
 results.push({name,result:expected??'accepted'});
}

function sign(d,key=1){const v=Buffer.from(secp256k1.sign(d,W(key),{prehash:false,format:'recovered'}));return Buffer.concat([v.subarray(1),Buffer.from([27+v[0]])]);}
const sig=sign(digest);await verify('valid_controller_signature',sig);
await verify('wrong_signer',sign(digest,2),'WALLET_SIGNATURE');
const changed=[...req];changed[6]=1n;await verify('changed_message',sig,'WALLET_SIGNATURE',changed);
const nonce=[...req];nonce[2]=1n;await verify('changed_nonce',sig,'WALLET_SIGNATURE',nonce);
await verify('empty_signature',Buffer.alloc(0),'WALLET_SIGNATURE');
await verify('short_signature',sig.subarray(0,64),'WALLET_SIGNATURE');
await verify('trailing_signature_byte',Buffer.concat([sig,Buffer.from([0])]),'WALLET_SIGNATURE');
const badV=Buffer.from(sig);badV[64]=0;await verify('invalid_recovery_id',badV,'WALLET_SIGNATURE');
const order=0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
const high=Buffer.concat([sig.subarray(0,32),W(order-BigInt('0x'+hex(sig.subarray(32,64)))),Buffer.from([sig[64]===27?28:27])]);
await verify('malleable_high_s',high,'WALLET_SIGNATURE');
const zeroS=Buffer.from(sig);zeroS.fill(0,32,64);await verify('zero_s',zeroS,'WALLET_SIGNATURE');
const zeroR=Buffer.from(sig);zeroR.fill(0,0,32);await verify('zero_r',zeroR,'WALLET_SIGNATURE');
await verify('direct_eoa_bypass',sig,'OWNER_CODE',req,'verifyPostEOA');
const stale=[...req];stale[1]=1n;await verify('stale_epoch',sig,'EPOCH',stale);
const badRoot=[...req];badRoot[5]=0n;await verify('wrong_root',sig,'ROOT',badRoot);
// Identical request for another vault has a different typed-data domain.
const other=await deploy(vaultCode,[BigInt(token.toString()),BigInt(wallet.toString()),BigInt(A.toString()),BigInt(A.toString())]);
const otherDigest=(await call(other,vaultCode,'postDigest',req)).returnValue;assert.notDeepEqual(Buffer.from(otherDigest),Buffer.from(digest));
await verify('other_contract_domain',sign(otherDigest),'WALLET_SIGNATURE');
await verify('valid_after_rejections',sig);
const report={schema:'caw-signer-wallet-validation/1',passed:results.length,results,compiler:solc.version(),sourceSha256:crypto.createHash('sha256').update(sources[files[0]].content).digest('hex'),walletSha256:crypto.createHash('sha256').update(sources[files[1]].content).digest('hex'),scope:'local deployed ECDSA wallet validation calls, not signed transaction lifecycle or EIP-7702',productionWallet:false};
fs.writeFileSync(out+'/result.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
