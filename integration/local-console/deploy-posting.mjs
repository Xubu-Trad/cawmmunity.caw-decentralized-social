// Only the launcher-owned isolated chain and public fixture signer are supported.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {Wallet,JsonRpcProvider,Interface,keccak256,getCreateAddress,version} from 'ethers';
const [configPath,artifactPath,output]=process.argv.slice(2);
assert.equal(version,'6.16.0');assert(!fs.existsSync(output));fs.mkdirSync(output);
const config=JSON.parse(fs.readFileSync(configPath)),artifact=JSON.parse(fs.readFileSync(artifactPath));
const url=new URL(config.rpcUrl);assert.equal(url.protocol,'http:');assert.equal(url.hostname,'127.0.0.1');assert.equal(url.username+url.password+url.search+url.hash,'');
const rpc=new JsonRpcProvider(url.href,31337,{staticNetwork:true,cacheTimeout:-1}),signer=new Wallet('0x'+'0'.repeat(63)+'3',rpc);
const registry=config.contracts.registry;
const observations=[];
try{
 assert.equal(signer.address.toLowerCase(),config.controller.toLowerCase());assert.equal(await rpc.send('eth_chainId',[]),'0x7a69');assert.equal((await rpc.getBlock(0)).hash,config.genesisHash);
 assert.equal(keccak256(await rpc.getCode(registry.address)),registry.codeHash);
 const abi=new Interface(artifact.abi),data=artifact.bytecode+abi.encodeDeploy([registry.address,registry.codeHash]).slice(2);
 const nonce=await rpc.getTransactionCount(signer.address,'pending');const tx=await signer.sendTransaction({data,nonce});
 let receipt;
 for(let i=0;i<100;i++){
  try{receipt=await rpc.send('eth_getTransactionReceipt',[tx.hash]);observations.push(receipt===null?'null':'receipt');}
  catch(e){const error=e.info?.error;if(error?.code!==-32000||error?.message!=='transaction indexing is in progress'||error?.data!=='transaction indexing is in progress')throw e;observations.push('indexing');}
  if(receipt!==null&&receipt!==undefined)break;await new Promise(r=>setTimeout(r,100));
 }
 assert(receipt);assert.equal(receipt.status,'0x1');assert.equal(receipt.transactionHash,tx.hash);assert.equal(receipt.to,null);assert(receipt.contractAddress);
 const block=await rpc.send('eth_getBlockByNumber',[receipt.blockNumber,false]);assert.equal(block.hash,receipt.blockHash);
 const actualTx=await rpc.send('eth_getTransactionByHash',[tx.hash]);assert.equal(actualTx.from.toLowerCase(),signer.address.toLowerCase());assert.equal(actualTx.input.toLowerCase(),data.toLowerCase());assert.equal(BigInt(actualTx.nonce),BigInt(nonce));
 assert.equal(actualTx.hash,tx.hash);assert.equal(actualTx.blockHash,receipt.blockHash);assert.equal(actualTx.blockNumber,receipt.blockNumber);assert.equal(actualTx.to,null);assert.equal(BigInt(actualTx.value),0n);assert.equal(BigInt(actualTx.chainId),31337n);assert.equal(receipt.from.toLowerCase(),signer.address.toLowerCase());assert.equal(receipt.contractAddress.toLowerCase(),getCreateAddress({from:signer.address,nonce}).toLowerCase());
 const expected=Buffer.from(artifact.runtimeTemplate.slice(2),'hex');
 for(const [id,refs]of Object.entries(artifact.immutableReferences)){
  const name=artifact.immutableNames[id];assert(['registry','registryCodeHash'].includes(name));
  const value=(name==='registry'?registry.address:registry.codeHash).slice(2).toLowerCase().padStart(64,'0');
  for(const ref of refs){assert.equal(ref.length,32);assert(ref.start>=0&&ref.start+32<=expected.length);Buffer.from(value,'hex').copy(expected,ref.start);}
 }
 const at={blockHash:receipt.blockHash,requireCanonical:true};const runtime=await rpc.send('eth_getCode',[receipt.contractAddress,at]);assert.equal(runtime.toLowerCase(),'0x'+expected.toString('hex'));
 const codeHash=keccak256(runtime),address=receipt.contractAddress.toLowerCase();
 for(const [name,wanted]of [['registry',registry.address],['registryCodeHash',registry.codeHash],['PROFILE',keccak256(Buffer.from('LOCAL_REGISTRY_POST_V1'))]]){
  const got=abi.decodeFunctionResult(name,await rpc.send('eth_call',[{to:address,data:abi.encodeFunctionData(name)},at]))[0];assert.equal(got.toLowerCase(),wanted.toLowerCase());
 }
 const newConfig={...config,contracts:{...config.contracts,posting:{address,codeHash}},postingDeployment:{transactionHash:tx.hash,blockNumber:receipt.blockNumber,blockHash:receipt.blockHash}};
 fs.writeFileSync(path.join(output,'console.json'),JSON.stringify(newConfig,null,2)+'\n');
 fs.writeFileSync(path.join(output,'deployment.json'),JSON.stringify({status:'LOCAL_UNPAID_POSTING_DEPLOYMENT',transaction:actualTx,receipt,runtime,expectedRuntimeHash:keccak256(expected),registry,genesisHash:config.genesisHash,receiptPolls:observations},null,2)+'\n');
 console.log(JSON.stringify({posting:address,codeHash,transactionHash:tx.hash,block:receipt.blockNumber}));
}finally{rpc.destroy();}
