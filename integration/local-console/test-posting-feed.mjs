// Feed rejection checks against a live disposable chain through a read-only proxy.
// Corruptions change one response field or one response envelope; the chain is untouched.
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createConsole} from './server.mjs';
const {Interface,keccak256,toUtf8Bytes}=createRequire(import.meta.url)('ethers');
const [configPath,out]=process.argv.slice(2);
assert.ok(configPath&&out&&process.argv.length===4,'USAGE: node test-posting-feed.mjs CONSOLE_CONFIG NEW_OUTPUT_DIRECTORY');
const configBytes=await fs.readFile(configPath),config=JSON.parse(configBytes);
const endpoint=new URL(config.rpcUrl);
assert.equal(endpoint.hostname,'127.0.0.1');assert.equal(endpoint.protocol,'http:');assert.equal(endpoint.username+endpoint.password+endpoint.search+endpoint.hash,'');
await fs.mkdir(out,{recursive:false});
const abi=new Interface(['function nextNonce(uint256) view returns(uint256)','event LocalPostPublished(uint256 indexed accountId,uint256 indexed epoch,uint256 indexed nonce,address author,bytes32 textHash,bytes text)']);
const event=abi.getEvent('LocalPostPublished'),posting=config.contracts.posting.address.toLowerCase();
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const readMethods=new Set(['eth_chainId','eth_getBlockByNumber','eth_getCode','eth_call','eth_getTransactionReceipt','eth_getLogs']);
const cases=[],requestCounts={},mutations=[],proxyErrors=[];let mode='baseline',proxy,consoleApp,activeMutations=0,nextId=10000;
let originalState,baseline,reference;
async function upstream(request){
 assert.ok(readMethods.has(request.method),'READ_ONLY_RPC_METHOD_REQUIRED');
 const response=await fetch(endpoint,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json'},body:JSON.stringify(request),signal:AbortSignal.timeout(5000)});
 assert.equal(response.status,200);const result=await response.json();assert.equal(result.jsonrpc,'2.0');assert.equal(result.id,request.id);return result;
}
async function direct(method,params){const result=await upstream({jsonrpc:'2.0',id:++nextId,method,params});assert.equal(Object.hasOwn(result,'error'),false);assert.ok(Object.hasOwn(result,'result'));return result.result;}
function corrupt(request,envelope){
 const changed=structuredClone(envelope),before=sha(JSON.stringify(envelope));let applied=false;
 if(request.method==='eth_getLogs'&&mode!=='creation-receipt'&&mode!=='baseline'){
  assert.ok(Array.isArray(changed.result)&&changed.result.length===3,'SELECTED_THREE_POSTS_REQUIRED');
  const log=changed.result[0];
  switch(mode){
   case 'dropped-log':changed.result.splice(1,1);applied=true;break;
   case 'swapped-logs':[changed.result[0],changed.result[1]]=[changed.result[1],changed.result[0]];applied=true;break;
   case 'text-hash':{
    const v=abi.parseLog(log);log.data=abi.encodeEventLog(event,[v.args.accountId,v.args.epoch,v.args.nonce,v.args.author,'0x'+'aa'.repeat(32),v.args.text]).data;applied=true;break;
   }
   case 'log-block-hash':log.blockHash='0x'+'bb'.repeat(32);applied=true;break;
   case 'trailing-abi-bytes':log.data+='00';applied=true;break;
   case 'rpc-error':delete changed.result;changed.error={code:-32000,message:'controlled unavailable history response'};applied=true;break;
   case 'invalid-utf8':{
    const v=abi.parseLog(log);log.data=abi.encodeEventLog(event,[v.args.accountId,v.args.epoch,v.args.nonce,v.args.author,v.args.textHash,'0xc080']).data;applied=true;break;
   }
   default:throw Error('UNRECOGNIZED_CONTROL');
  }
 }
 if(mode==='creation-receipt'&&request.method==='eth_getTransactionReceipt'&&request.params[0]===config.postingDeployment.transactionHash){
  assert.ok(changed.result);changed.result.blockHash='0x'+'cc'.repeat(32);applied=true;
 }
 if(applied){activeMutations++;assert.equal(activeMutations,1,'ONLY_ONE_CHANGED_RESPONSE_PER_CASE');mutations.push({mode,method:request.method,beforeSha256:before,afterSha256:sha(JSON.stringify(changed))});}
 return changed;
}
async function expectReject(name,control,expected){
 mode=control;activeMutations=0;let returned=false,observed;
 try{await consoleApp.posts();returned=true;}catch(error){observed=error;}
 assert.equal(returned,false,name+': corrupted history must not become an accepted or empty feed');
 assert.ok(observed,name+': rejection required');assert.equal(activeMutations,1,name+': exact control must be exercised');
 if(control==='invalid-utf8'){
  assert.equal(observed.name,'TypeError');assert.equal(observed.code,'ERR_ENCODING_INVALID_ENCODED_DATA');
 }else assert.ok(expected.includes(observed.message),name+': unexpected rejection '+observed.message);
 cases.push({name,pass:true,control,error:observed.message,...(observed.code?{code:observed.code}:{})});
 console.log('PASS '+name);
 mode='baseline';activeMutations=0;
}
try{
 assert.equal(await direct('eth_chainId',[]),'0x7a69');assert.equal((await direct('eth_getBlockByNumber',['0x0',false])).hash,config.genesisHash);
 proxy=http.createServer(async(req,res)=>{
  try{
   assert.equal(req.method,'POST');assert.equal(req.headers.host,'127.0.0.1:'+proxy.address().port);
   let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;assert.ok(size<=8192);chunks.push(chunk);}
   const request=JSON.parse(Buffer.concat(chunks));assert.ok(!Array.isArray(request));assert.ok(readMethods.has(request.method),'READ_ONLY_RPC_METHOD_REQUIRED');
   requestCounts[request.method]=(requestCounts[request.method]??0)+1;
   const original=await upstream(request),response=corrupt(request,original);
   res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(response));
  }catch(error){proxyErrors.push(error.message);res.writeHead(502,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'READ_ONLY_PROXY_FAILURE'}));}
 });
 await new Promise((resolve,reject)=>{proxy.once('error',reject);proxy.listen(0,'127.0.0.1',resolve);});
 consoleApp=createConsole({...config,rpcUrl:'http://127.0.0.1:'+proxy.address().port});
 originalState=await consoleApp.snapshot();assert.equal(originalState.posting.nonce,'3');
 baseline=await consoleApp.posts();assert.equal(baseline.posts.length,3);assert.equal(baseline.publicChainAuthenticated,false);
 // Independent direct reads bypass the alteration proxy. Compare receipt logs and
 // canonical block identities as well as the precise nonce/text/hash sequence.
 const logs=await direct('eth_getLogs',[{address:posting,fromBlock:config.postingDeployment.blockNumber,toBlock:baseline.blockNumber,topics:[event.topicHash,'0x'+'2'.padStart(64,'0')]}]);
 assert.equal(logs.length,3);reference=[];
 const expectedTexts=['CAW — みんなで作る。','a'.repeat(420),'🌒'.repeat(420)];
 for(let index=0;index<logs.length;index++){
  const log=logs[index],decoded=abi.parseLog(log),receipt=await direct('eth_getTransactionReceipt',[log.transactionHash]);
  assert.equal(receipt.status,'0x1');assert.equal(receipt.blockHash,log.blockHash);
  assert.equal((await direct('eth_getBlockByNumber',[log.blockNumber,false])).hash,log.blockHash);
  const matches=receipt.logs.filter(x=>x.address.toLowerCase()===posting&&x.logIndex===log.logIndex);
  assert.equal(matches.length,1);assert.deepEqual(matches[0].topics,log.topics);assert.equal(matches[0].data,log.data);
  const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(Buffer.from(decoded.args.text.slice(2),'hex'));
  assert.equal(text,expectedTexts[index]);assert.equal(decoded.args.accountId,2n);assert.equal(decoded.args.nonce,BigInt(index));assert.equal(decoded.args.epoch,1n);assert.equal(decoded.args.author.toLowerCase(),config.contracts.wallet.address.toLowerCase());
  assert.equal(decoded.args.textHash,keccak256(toUtf8Bytes(text)));
  reference.push({accountId:'2',epoch:'1',nonce:String(index),author:decoded.args.author.toLowerCase(),text,textHash:decoded.args.textHash,transactionHash:log.transactionHash,blockHash:log.blockHash,blockNumber:log.blockNumber});
 }
 assert.deepEqual(baseline.posts,reference);cases.push({name:'three-post feed matches direct receipt logs, exact UTF-8 text, nonces and local canonical blocks',pass:true});
 await expectReject('missing log is rejected rather than an incomplete timeline','dropped-log',['INCOMPLETE_POST_HISTORY']);
 await expectReject('swapped logs are rejected rather than silently reordered','swapped-logs',['POST_LOG_ORDER','POST_NONCE_GAP']);
 await expectReject('changed text hash is rejected','text-hash',['POST_TEXT_MISMATCH']);
 await expectReject('changed log block hash is rejected','log-block-hash',['POST_HISTORY_REORG']);
 await expectReject('trailing ABI bytes are rejected rather than accepted by a permissive decoder','trailing-abi-bytes',['POST_LOG_ENCODING']);
 await expectReject('mismatched posting creation receipt is rejected','creation-receipt',['POSTING_CREATION_MISMATCH']);
 await expectReject('RPC error cannot become an empty timeline','rpc-error',['RPC_RESPONSE']);
 await expectReject('malformed UTF-8 is rejected by the fatal decoder','invalid-utf8',[]);
 assert.deepEqual(await consoleApp.posts(),baseline);assert.deepEqual(await consoleApp.snapshot(),originalState);assert.equal(proxyErrors.length,0);
 cases.push({name:'unaltered feed recovers after controls and selected chain state is unchanged',pass:true});
 const result={status:'pass',scope:'Read-only feed validation against three signed local fixture posts through a response-altering loopback proxy. Direct receipt/block reads share the same local Geth trust boundary; this is not public-chain authentication or independent-operator reproduction.',configSha256:sha(configBytes),genesisHash:config.genesisHash,cases,reference,mutations,requestCounts,proxyErrors,noChainMutation:true};
 await fs.writeFile(path.join(out,'result.json'),JSON.stringify(result,null,2)+'\n');
 const bytes=await fs.readFile(path.join(out,'result.json'));console.log(`PARENTS=[${sha(configBytes)},${config.genesisHash}] TRANSFORM="read-only local posting feed rejection controls" SHA256=${sha(bytes)} SIZE=${bytes.length} PATH=result.json`);
}catch(error){await fs.writeFile(path.join(out,'failure.json'),JSON.stringify({status:'failed',message:error.message,stack:error.stack,cases,mutations,requestCounts,proxyErrors,originalState},null,2)+'\n');throw error;}
finally{
 if(consoleApp?.server.listening)await new Promise(resolve=>consoleApp.server.close(resolve));
 if(proxy?.listening){proxy.closeAllConnections();await new Promise(resolve=>proxy.close(resolve));}
}
