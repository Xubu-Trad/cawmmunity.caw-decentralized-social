// Explicit local transaction test. Run only against a fresh disposable fixture.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {Wallet,JsonRpcProvider,FetchRequest,Interface,AbiCoder,keccak256,toUtf8Bytes,hexlify,version}=createRequire(import.meta.url)('ethers');
assert.equal(version,'6.16.0');
const [configPath,artifactPath,out]=process.argv.slice(2);assert(configPath&&artifactPath&&out&&process.argv.length===5,'USAGE: node test-posting-contract.mjs CONSOLE_CONFIG POSTING_ARTIFACT NEW_OUTPUT_DIRECTORY');
assert(!fs.existsSync(out),'NEW_OUTPUT_REQUIRED');
const config=JSON.parse(fs.readFileSync(configPath)),artifactBytes=fs.readFileSync(artifactPath),artifact=JSON.parse(artifactBytes),endpoint=new URL(config.rpcUrl);
assert.equal(endpoint.protocol,'http:');assert.equal(endpoint.hostname,'127.0.0.1');assert.equal(endpoint.username+endpoint.password+endpoint.search+endpoint.hash,'');
assert.equal(artifact.schema,'caw-local-unpaid-posting/1');assert.equal(artifact.sourceSha256,'861f78c36d4dbe9d5ed380e716307039e264757bd51e833d28771b44444e7125');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex'),lower=x=>x.toLowerCase();
assert.equal(sha(Buffer.from(artifact.bytecode.slice(2),'hex')),artifact.creationSha256);
assert.equal(sha(Buffer.from(artifact.runtimeTemplate.slice(2),'hex')),artifact.runtimeTemplateSha256);
assert.equal(artifact.creationSha256,'6b03a784382bb42f387f4e684334635c2dfff26d7f773960481d399513306c83');
assert.equal(artifact.runtimeTemplateSha256,'ccf21adeffe270d0c148625f643dd6592ef17bd027a575fbb029f8cf882cf4d0');
assert.equal(sha(JSON.stringify(artifact.abi)),'cf0495a97e3cd39e804317a8699cf2f254c4c5cf8ebb0081f6d952660de06e33');
const names=['wallet','registry','custody','token','posting'],addresses=Object.fromEntries(names.map(n=>[n,config.contracts[n].address]));
assert.equal(new Set(Object.values(addresses).map(lower)).size,5);
const request=new FetchRequest(endpoint.href);request.timeout=5000;
const rpc=new JsonRpcProvider(request,31337,{staticNetwork:true});
// Public fixture keys only. No key is written to the result package.
const controller=new Wallet('0x'+('3'.padStart(64,'0')),rpc),outsider=new Wallet('0x'+('4'.padStart(64,'0')));
assert.equal(lower(controller.address),lower(config.controller));
const posting=new Interface(artifact.abi),wallet=new Interface(['function controller() view returns(address)','function execute(address,bytes) returns(bytes)']);
const registry=new Interface(['function authority(uint256) view returns(address,uint256)']);
const custody=new Interface(['function credits(uint256) view returns(uint256)']);
const token=new Interface(['function balanceOf(address) view returns(uint256)']);
const cases=[],transactions=[];let initial=null;
fs.mkdirSync(out);
function save(name,value){fs.writeFileSync(path.join(out,name),JSON.stringify(value,null,2)+'\n');}
function pass(name,evidence={}){cases.push({name,pass:true,...evidence});save('progress.json',{scope:'LOCAL_UNPAID_POSTING_RESEARCH',cases,transactions});}
async function call(to,abi,method,args=[],at='latest',from=controller.address){const raw=await rpc.send('eth_call',[{from,to,data:abi.encodeFunctionData(method,args)},at]);return abi.decodeFunctionResult(method,raw);}
async function snapshot(){
 const block=await rpc.send('eth_getBlockByNumber',['latest',false]),at={blockHash:block.hash,requireCanonical:true};
 const [owner,epoch]=await call(addresses.registry,registry,'authority',[2],at);
 const [nonce]=await call(addresses.posting,posting,'nextNonce',[2],at),[credit]=await call(addresses.custody,custody,'credits',[2],at);
 const balances={};for(const n of ['wallet','custody'])balances[n]=String((await call(addresses.token,token,'balanceOf',[addresses[n]],at))[0]);
 return {blockHash:block.hash,blockNumber:block.number,owner:lower(owner),epoch:String(epoch),nonce:String(nonce),credit:String(credit),balances};
}
function accounting(state){return {owner:state.owner,epoch:state.epoch,credit:state.credit,balances:state.balances};}
function encoded(epoch,nonce,text,account=2){return posting.encodeFunctionData('publish',[account,epoch,nonce,text]);}
function wrapped(data){return wallet.encodeFunctionData('execute',[addresses.posting,data]);}
function revertData(error){const candidates=[error?.data,error?.error?.data,error?.info?.error?.data];for(const candidate of candidates){if(typeof candidate==='string'&&candidate.startsWith('0x08c379a0'))return candidate;if(candidate&&typeof candidate==='object'&&typeof candidate.data==='string'&&candidate.data.startsWith('0x08c379a0'))return candidate.data;}return null;}
async function reject(name,data,reason,{from=controller.address,to=addresses.wallet}={}){
 const before=await snapshot();let observed;
 try{await rpc.send('eth_call',[{from,...(to?{to}:{}),data,gas:'0x4c4b40'},before.blockNumber]);throw Error('UNEXPECTED_CALL_SUCCESS');}
 catch(error){const raw=revertData(error);assert(raw,name+': missing ABI Error(string)');observed=AbiCoder.defaultAbiCoder().decode(['string'],'0x'+raw.slice(10))[0];assert.equal(observed,reason,name);}
 assert.deepEqual(await snapshot(),before,name+': call changed selected state');pass(name,{reason:observed,kind:'eth_call_negative_control',blockHash:before.blockHash});
}
async function publish(text,label){
 const before=await snapshot(),raw=typeof text==='string'&&text.startsWith('0x')?text:hexlify(toUtf8Bytes(text));
 const data=wrapped(encoded(before.epoch,before.nonce,raw));
 const outerNonce=BigInt(await rpc.send('eth_getTransactionCount',[controller.address,'pending']));assert(outerNonce<BigInt(Number.MAX_SAFE_INTEGER));
 const sent=await controller.sendTransaction({to:addresses.wallet,data,value:0,chainId:31337,nonce:Number(outerNonce),gasLimit:1500000,maxFeePerGas:2,maxPriorityFeePerGas:1});
 const receipt=await sent.wait(1,30000);assert(receipt);assert.equal(receipt.status,1);
 const transaction=await rpc.send('eth_getTransactionByHash',[sent.hash]);assert.equal(lower(transaction.input),lower(data));assert.equal(lower(transaction.from),lower(controller.address));assert.equal(lower(transaction.to),lower(addresses.wallet));assert.equal(BigInt(transaction.nonce),outerNonce);
 const logs=receipt.logs.filter(log=>lower(log.address)===lower(addresses.posting));assert.equal(logs.length,1);const event=posting.parseLog(logs[0]);assert.equal(event.name,'LocalPostPublished');
 assert.equal(event.args.accountId,2n);assert.equal(event.args.epoch,BigInt(before.epoch));assert.equal(event.args.nonce,BigInt(before.nonce));assert.equal(lower(event.args.author),lower(before.owner));assert.equal(lower(event.args.text),lower(raw));assert.equal(event.args.textHash,keccak256(raw));
 const after=await snapshot();assert.equal(BigInt(after.nonce),BigInt(before.nonce)+1n);assert.deepEqual(accounting(after),accounting(before));
 transactions.push({hash:sent.hash,blockHash:receipt.blockHash,blockNumber:receipt.blockNumber,nonce:outerNonce.toString(),postNonce:before.nonce,textBytes:(raw.length-2)/2,textHash:keccak256(raw),status:receipt.status});pass(label,{kind:'signed_local_transaction',transactionHash:sent.hash,textBytes:(raw.length-2)/2});return {before,after,raw};
}
try{
 assert.equal(await rpc.send('eth_chainId',[]),'0x7a69');assert.equal((await rpc.send('eth_getBlockByNumber',['0x0',false])).hash,config.genesisHash);
 for(const name of names)assert.equal(keccak256(await rpc.send('eth_getCode',[addresses[name],'latest'])),config.contracts[name].codeHash,'CODE_'+name);
 assert.equal(lower((await call(addresses.wallet,wallet,'controller'))[0]),lower(controller.address));
 assert.equal(lower((await call(addresses.posting,posting,'registry'))[0]),lower(addresses.registry));assert.equal(lower((await call(addresses.posting,posting,'registryCodeHash'))[0]),lower(config.contracts.registry.codeHash));
 assert.equal((await call(addresses.posting,posting,'PROFILE'))[0],keccak256(toUtf8Bytes('LOCAL_REGISTRY_POST_V1')));
 const runtime=Buffer.from(artifact.runtimeTemplate.slice(2),'hex'),covered=new Set();
 assert.deepEqual(Object.values(artifact.immutableNames).sort(),['registry','registryCodeHash']);
 for(const [id,refs]of Object.entries(artifact.immutableReferences)){
  const name=artifact.immutableNames[id];assert(['registry','registryCodeHash'].includes(name));const value=name==='registry'?addresses.registry:config.contracts.registry.codeHash;
  const bytes=Buffer.from(value.slice(2).padStart(64,'0'),'hex');
  for(const ref of refs){assert.equal(ref.length,32);assert(ref.start>=0&&ref.start+32<=runtime.length);for(let i=ref.start;i<ref.start+32;i++){assert(!covered.has(i));covered.add(i);}bytes.copy(runtime,ref.start);}
 }
 assert.equal(keccak256(runtime),config.contracts.posting.codeHash,'COMPLETE_INSTANTIATED_RUNTIME');
 initial=await snapshot();assert.equal(initial.owner,lower(addresses.wallet));assert.equal(initial.epoch,'1');assert.equal(initial.nonce,'0');assert.equal(initial.credit,'2');pass('selected local chain, complete instantiated runtime and registry binding agree');
 const constructorData=(r,h)=>artifact.bytecode+posting.encodeDeploy([r,h]).slice(2),zero='0x'+'0'.repeat(40),zeroHash='0x'+'0'.repeat(64);
 await reject('constructor rejects zero registry',constructorData(zero,config.contracts.registry.codeHash),'REGISTRY',{to:null});
 await reject('constructor rejects plain account registry',constructorData(controller.address,config.contracts.registry.codeHash),'REGISTRY',{to:null});
 await reject('constructor rejects incorrect registry hash',constructorData(addresses.registry,zeroHash),'REGISTRY_CODE',{to:null});
 await reject('controller cannot bypass current contract-wallet ownership',encoded(1,0,'0x61'),'OWNER',{to:addresses.posting});
 await reject('outsider cannot invoke fixture wallet',wrapped(encoded(1,0,'0x61')),'CONTROLLER',{from:outsider.address});
 await reject('unsupported account rejects',wrapped(encoded(1,0,'0x61',3)),'ACCOUNT');
 await reject('stale ownership epoch rejects',wrapped(encoded(0,0,'0x61')),'EPOCH');
 await reject('future post nonce rejects',wrapped(encoded(1,1,'0x61')),'NONCE');
 for(const [label,raw,reason]of [
  ['empty','0x','TEXT_LENGTH'],['421 scalars',hexlify(toUtf8Bytes('a'.repeat(421))),'TEXT_LENGTH'],['1681 bytes',hexlify(toUtf8Bytes('a'.repeat(1681))),'TEXT_LENGTH'],
  ['overlong','0xc080','UTF8'],['isolated continuation','0x80','UTF8'],['truncated','0xe282','UTF8'],['surrogate','0xeda080','UTF8'],['above Unicode maximum','0xf4908080','UTF8'],['bad continuation','0xe228a1','UTF8']
 ])await reject('text rejects '+label,wrapped(encoded(1,0,raw)),reason);
 const first=await publish('CAW — みんなで作る。','signed Unicode post publishes exact bytes without changing custody');
 await reject('replaying the consumed post nonce rejects',wrapped(encoded(1,first.before.nonce,first.raw)),'NONCE');
 await publish('a'.repeat(420),'420 scalar boundary publishes');
 await publish('🌒'.repeat(420),'1680 byte boundary publishes');
 const final=await snapshot();assert.equal(final.nonce,'3');assert.deepEqual(accounting(final),accounting(initial));
 save('result.json',{status:'pass',scope:'Unpaid local registry-owner posting. Real signed transactions for three successful posts; constructor/authorization/replay/invalid-text cases are read-only eth_call controls with exact revert reasons and unchanged selected state. No public deployment, wallet-extension, paid settlement, independent-client reproduction or production proof.',artifactSha256:sha(artifactBytes),genesisHash:config.genesisHash,cases,transactions,initial,final});
 const result=fs.readFileSync(path.join(out,'result.json'));console.log(`PARENTS=[${sha(artifactBytes)},${config.genesisHash}] TRANSFORM="local unpaid posting contract checks" SHA256=${sha(result)} SIZE=${result.length} PATH=result.json`);
}catch(error){save('failure.json',{status:'failed',message:error.message,cases,transactions,initial});throw error;}
finally{rpc.destroy();}
