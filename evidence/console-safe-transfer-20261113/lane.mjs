import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const [dir,out,mode]=process.argv.slice(2);
const req=createRequire(path.join(dir,'package.json'));
const {Wallet,Interface,AbiCoder,Transaction,keccak256,encodeRlp,toBeHex,toUtf8Bytes}=req('ethers');
const imp=f=>import(pathToFileURL(path.join(dir,f)));
const {verifyPostingHistory,POST_NONCE}=await imp('verify-posting-history.mjs');
const {verifyOwnerPostBlock,reconstructOwnerPostSequence}=await imp('post-authority-sequence.mjs');
const {acquireVerifiedPosts}=await imp('strict-console-acquisition.mjs');
const {inspectHeaderBoundStateProof}=await imp('../../reference/header-bound-state-proof.mjs');
const {inspectBlockTransactionReceipts}=await imp('../../reference/ethereum-block-transactions.mjs');
const {inspectExecutionHeader}=await imp('../../reference/ethereum-execution-header.mjs');
const read=f=>JSON.parse(fs.readFileSync(path.join(out,f)));
const save=(f,x)=>fs.writeFileSync(path.join(out,f+'.json'),JSON.stringify(x,(_,v)=>typeof v==='bigint'?v.toString():v,2)+'\n');
const cfg=read('deploy/console.json'), url=new URL(cfg.rpcUrl);
assert.equal(url.hostname,'127.0.0.1');assert.equal(url.protocol,'http:');
let id=0;const trace=[];
const rpc=async(method,params=[])=>{
 const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:++id,method,params}),signal:AbortSignal.timeout(3000)});
 const v=await r.json();if(method!=='eth_sendRawTransaction')trace.push({method,params,...v.error?{error:v.error}:{result:v.result}});
 if(v.error)throw Error(JSON.stringify(v.error));return v.result;
};
const account=new Wallet(process.env.PUBLIC_FIXTURE_SIGNER);
const C=cfg.contracts, addr=account.address.toLowerCase();
const ABI=new Interface(['function authority(uint256) view returns(address,uint256)','function credits(uint256) view returns(uint256)','function unpaidLiability() view returns(uint256)','function balanceOf(address) view returns(uint256)','function allowance(address,address) view returns(uint256)','function nextNonce(uint256) view returns(uint256)','function publish(uint256,uint256,uint256,bytes)','function execute(address,bytes)','function transferFrom(address,address,uint256)','function safeTransferFrom(address,address,uint256)','event LocalPostPublished(uint256 indexed accountId,uint256 indexed epoch,uint256 indexed nonce,address author,bytes32 textHash,bytes text)']);
const slot=(key,index)=>keccak256(AbiCoder.defaultAbiCoder().encode(['uint256','uint256'],[key,index]));
const OWNER='0xabbb5caa7dda850e60932de0934eb1f9d0f59695050f761dc64e443e5030a569', EPOCH='0x91da3fd0782e51c6b3986e9e672fd566868e71f3dbc2d6c2cd6fbb3e361af2a7';
assert.equal(POST_NONCE,slot(2,0));
const at=h=>({blockHash:h.hash,requireCanonical:true});
const call=async(h,kind,name,args=[])=>ABI.decodeFunctionResult(name,await rpc('eth_call',[{to:C[kind].address,data:ABI.encodeFunctionData(name,args)},at(h)]));
async function state(h){
 const [owner,epoch]=await call(h,'registry','authority',[2]);
 const v=async(k,n,args)=>(await call(h,k,n,args))[0];
 return {owner:owner.toLowerCase(),epoch:String(epoch),nonce:String(await v('posting','nextNonce',[2])),credit:String(await v('custody','credits',[2])),liability:String(await v('custody','unpaidLiability',[])),allowance:String(await v('token','allowance',[addr,C.custody.address])),balances:Object.fromEntries(await Promise.all([addr,C.wallet.address,C.custody.address].map(async a=>[a,String(await v('token','balanceOf',[a]))])))};
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const q=n=>BigInt(n)?toBeHex(BigInt(n)):'0x';
const fields='parentHash sha3Uncles miner stateRoot transactionsRoot receiptsRoot logsBloom difficulty number gasLimit gasUsed timestamp extraData mixHash nonce baseFeePerGas withdrawalsRoot'.split(' ');
const quantities=new Set('difficulty number gasLimit gasUsed timestamp baseFeePerGas'.split(' '));
const headerHash=h=>keccak256(encodeRlp(fields.map(k=>quantities.has(k)?q(h[k]):h[k])));
function root2(a,b){const branch=Array(17).fill('0x');branch[8]=keccak256(encodeRlp(['0x30',a]));branch[0]=keccak256(encodeRlp(['0x31',b]));return keccak256(encodeRlp(branch))}
const receiptBytes=r=>'0x'+r.type.slice(2).padStart(2,'0')+encodeRlp([q(r.status),q(r.cumulativeGasUsed),r.logsBloom,r.logs.map(l=>[l.address,l.topics,l.data])]).slice(2);
const headerSel=h=>({schema:'caw-execution-header-selection/1',profile:'shanghai-17',hash:h.hash});
try{
 assert.equal(await rpc('eth_chainId'),'0x7a69');
 assert.equal(addr,cfg.controller);
 const anchor=await rpc('eth_getBlockByNumber',[cfg.postingDeployment.blockNumber,false]);
 inspectExecutionHeader(anchor,headerSel(anchor));assert.equal(headerHash(anchor),anchor.hash);
 for(const c of Object.values(C))assert.equal(keccak256(await rpc('eth_getCode',[c.address,at(anchor)])),c.codeHash);
 const before=await state(anchor);assert.equal(before.nonce,'0');assert.equal(before.owner,C.wallet.address);assert.equal(before.epoch,'1');
 const proof=(h,k,keys)=>rpc('eth_getProof',[C[k].address,keys,at(h)]);
 const parent={registry:await proof(anchor,'registry',[OWNER,EPOCH]),posting:await proof(anchor,'posting',[POST_NONCE]),owner:await proof(anchor,'wallet',[])};
 const texts=['POST-BATCH R-01 first','POST-BATCH R-01 second — 鴉'];
 const nonce=BigInt(await rpc('eth_getTransactionCount',[addr,'pending']));
 const txs=[];
 const {createConsole:makePlanningConsole}=await imp('server.mjs');
 const planner=makePlanningConsole(cfg);const transferPlan=await planner.transferPlan(addr);
 save('console-transfer-plan',transferPlan);
 assert.equal(transferPlan.from,addr);assert.equal(transferPlan.to,C.wallet.address);
 for(let i=0;i<2;i++){
  const transfer=ABI.encodeFunctionData('safeTransferFrom',[C.wallet.address,addr,2]);
  const post=ABI.encodeFunctionData('publish',[2,BigInt(before.epoch)+1n,0,toUtf8Bytes(texts[1])]);
  const raw=await account.signTransaction({type:2,chainId:31337,nonce:Number(nonce)+i,to:i===0?C.wallet.address:C.posting.address,data:i===0?ABI.encodeFunctionData('execute',[C.registry.address,transfer]):post,value:0,gasLimit:500000,maxFeePerGas:2000000000n,maxPriorityFeePerGas:1000000000n});
  if(i===0)assert.equal(Transaction.from(raw).data,transferPlan.data);
  txs.push({raw,hash:keccak256(raw)});
 }
 save('pre-submit',{anchor,before,parent,txs,texts,mode});
 const started=Date.now();
 for(const t of txs)assert.equal(await rpc('eth_sendRawTransaction',[t.raw]),t.hash);
 const submitMs=Date.now()-started;
 const receipts=[];
 for(const t of txs){
  let r;
  for(let i=0;i<100&&!r;i++){try{r=await rpc('eth_getTransactionReceipt',[t.hash]);}catch(e){if(!e.message.includes('transaction indexing is in progress'))throw e}if(!r)await sleep(100)}
  assert(r,'RECEIPT_TIMEOUT');receipts.push(r);
 }
 save('mined-receipts',receipts);
 assert.equal(receipts[0].blockHash,receipts[1].blockHash,'NOT_SAME_MINED_BLOCK');
 const h=await rpc('eth_getBlockByHash',[receipts[0].blockHash,false]);
 assert.equal(h.parentHash,anchor.hash,'BATCH_NOT_IMMEDIATELY_AFTER_DEPLOY');
 assert.deepEqual(h.transactions,txs.map(t=>t.hash));
 assert.deepEqual(receipts.map(r=>r.transactionIndex),['0x0','0x1']);
 assert.deepEqual(receipts.map(r=>r.status),mode==='revert'?['0x1','0x0']:['0x1','0x1']);
 const raws=await Promise.all(txs.map(t=>rpc('eth_getRawTransactionByHash',[t.hash])));
 const transactions=await Promise.all(txs.map(t=>rpc('eth_getTransactionByHash',[t.hash])));
 assert.deepEqual(raws,txs.map(t=>t.raw));
 assert.deepEqual(raws.map(r=>Transaction.from(r).from.toLowerCase()),[addr,addr]);
 for(let i=0;i<2;i++){assert.equal(transactions[i].from,addr);assert.equal(transactions[i].transactionIndex,receipts[i].transactionIndex);assert.equal(transactions[i].hash,txs[i].hash);}
 assert.equal(headerHash(h),h.hash);
 assert.equal(root2(...raws),h.transactionsRoot);
 assert.equal(root2(...receipts.map(receiptBytes)),h.receiptsRoot);
 inspectBlockTransactionReceipts(h,raws,receipts,{schema:'caw-block-transactions-selection/1',profile:'shanghai-17',hash:h.hash});
 const after=await state(h);
 assert.equal(after.owner,addr);assert.equal(after.epoch,'2');assert.equal(after.nonce,'1');
 assert.deepEqual({...after,owner:before.owner,epoch:before.epoch,nonce:before.nonce},before);
 const selection={startHash:anchor.hash,endHash:h.hash,controller:addr,contracts:C};
 const ownerBundle={schema:'local-owner-post-block/1',parent:anchor,header:h,rawTransactions:raws,receipts,
  initialRegistry:parent.registry,initialPosting:parent.posting,
  ownerProofs:{[C.wallet.address]:parent.owner,[addr]:await rpc('eth_getProof',[addr,[],at(anchor)])},
  finalRegistry:await proof(h,'registry',[OWNER,EPOCH]),finalPosting:await proof(h,'posting',[POST_NONCE])};
 const {verifyOwnerPostBlock:oldVerifier}=await imp('post-authority-sequence-before-safe.mjs');
 let oldError;assert.throws(()=>oldVerifier(ownerBundle,selection),e=>{oldError=e.message;return e.message.includes('TRANSFER_CALLDATA')});
 save('before-fix-rejection',{error:oldError,scope:'Previous verifier rejects the genuinely mined console safe-transfer call.'});
 const result=verifyOwnerPostBlock(ownerBundle,selection);assert.equal(result.transfers.length,1);assert.equal(result.posts.length,1);assert.equal(result.posts[0].author,addr);assert.equal(result.epoch,'2');assert.equal(result.nonce,'1');
 save('owner-post-evidence',{ownerBundle,selection,before,after,result});
 const {createConsole}=await imp('server.mjs');
 const app=createConsole(cfg);await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 try{
  const endpoint='http://127.0.0.1:'+app.server.address().port+'/api/verified-posts';
  const response=await fetch(endpoint,{signal:AbortSignal.timeout(30000)}),body=await response.json();
  save('console-response',{httpStatus:response.status,body});
  assert.equal(response.status,200);assert.equal(body.status,'VERIFIED_LOCAL_HISTORY');
  assert.equal(body.blockHash,h.hash);assert.equal(body.intraBlockOwnershipVerified,true);
  assert.equal(body.posts.length,1);assert.equal(body.transfers.length,1);
  assert.equal(body.posts[0].author,addr);assert.equal(body.posts[0].epoch,'2');assert.equal(body.posts[0].nonce,'0');
  assert.equal(body.posts[0].transactionHash,txs[1].hash);assert.equal(body.publicChainAuthenticated,false);
  const repeat=await fetch(endpoint,{signal:AbortSignal.timeout(30000)});const repeated=await repeat.json();
  assert.equal(repeat.status,200);assert.deepEqual(repeated,body);
  save('console-checks',{passed:10,checks:['HTTP200','verified status','fresh header match','ownership path','one post and one transfer','new owner','new epoch','nonce and signed transaction','local-only label','repeat identical'],scope:'Fresh isolated local Geth via actual console HTTP; same operator, not independent reproduction.'});
 }finally{app.server.closeAllConnections();await new Promise(r=>app.server.close(r));}

 // Compatibility shape for the established complete-history collector.
 save('genuine-evidence',{bundle:{blocks:[{header:h}]}});
 const mutations=[];
 for(const [name,mutate] of [
  ['reversed raw',b=>b.rawTransactions.reverse()],
  ['missing receipt',b=>b.receipts.pop()],
  ['false status',b=>b.receipts[0].status='0x0'],
  ['corrupt initial registry',b=>b.initialRegistry.accountProof[0]='0xc0'],
  ['corrupt final registry',b=>b.finalRegistry.accountProof[0]='0xc0'],
  ['false final epoch',b=>b.finalRegistry.storageProof.find(s=>s.key===EPOCH).value='0x1'],
  ['missing recipient proof',b=>delete b.ownerProofs[addr]],
  ['false final nonce',b=>b.finalPosting.storageProof[0].value='0x2']
 ]){const b=structuredClone(ownerBundle);mutate(b);assert.throws(()=>verifyOwnerPostBlock(b,selection),e=>{mutations.push({name,error:e.code??e.message});return true});}
 save('mutations',mutations);
 // Semantic controls start from already root/signature-checked RPC transactions.
 const checkedTxs=transactions.map(x=>({...x,data:x.input}));
 const initial={owner:before.owner,epoch:before.epoch,nonce:before.nonce};
 const semantic=[];
 for(const [name,mutate,expected] of [
  ['stale signer after transfer',(t,r)=>t[1].from=C.wallet.address,'CURRENT_OWNER_SIGNER'],
  ['stale epoch after transfer',(t,r)=>r[1].logs[0].topics[2]='0x'+BigInt(before.epoch).toString(16).padStart(64,'0'),'CURRENT_EPOCH'],
  ['nonzero value',(t,r)=>t[1].value='0x1','ZERO_VALUE'],
  ['approved delegate unsupported',(t,r)=>t[0].from='0x'+'11'.repeat(20),'CURRENT_OWNER_SIGNER'],
  ['extra action',(t,r)=>r[0].logs.push(r[0].logs[0]),'SUPPORTED_ACTION_ONLY'],
  ['reverted transfer',(t,r)=>r[0].status='0x0','SUCCESS_ONLY']
 ]){const t=structuredClone(checkedTxs),r=structuredClone(receipts);mutate(t,r);assert.throws(()=>reconstructOwnerPostSequence(t,r,initial,selection,()=>{}),e=>{assert(e.message.includes(expected));semantic.push({name,expected});return true});}
 save('semantic-controls',semantic);
 console.log(JSON.stringify({block:h.hash,number:h.number,after,result,proofControls:mutations.length,semanticControls:semantic.length}));
}finally{save('rpc-trace',trace)}
