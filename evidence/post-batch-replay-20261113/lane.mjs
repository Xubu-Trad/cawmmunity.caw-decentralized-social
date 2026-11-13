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
const ABI=new Interface(['function authority(uint256) view returns(address,uint256)','function credits(uint256) view returns(uint256)','function unpaidLiability() view returns(uint256)','function balanceOf(address) view returns(uint256)','function allowance(address,address) view returns(uint256)','function nextNonce(uint256) view returns(uint256)','function publish(uint256,uint256,uint256,bytes)','function execute(address,bytes)','event LocalPostPublished(uint256 indexed accountId,uint256 indexed epoch,uint256 indexed nonce,address author,bytes32 textHash,bytes text)']);
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
 for(let i=0;i<2;i++){
  const mixed=mode==='mixed'&&i===1;
  const inner=ABI.encodeFunctionData('publish',[2,before.epoch,mode==='revert'&&i===1?0:i,toUtf8Bytes(texts[i])]);
  const raw=await account.signTransaction({type:2,chainId:31337,nonce:Number(nonce)+i,to:mixed?addr:C.wallet.address,data:mixed?'0x':ABI.encodeFunctionData('execute',[C.posting.address,inner]),value:0,gasLimit:500000,maxFeePerGas:2000000000n,maxPriorityFeePerGas:1000000000n});
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
 assert.deepEqual({...after,nonce:before.nonce},before);
 assert.equal(after.nonce,mode==='positive'?'2':'1');
 const finalPosting=await proof(h,'posting',[POST_NONCE]);
 for(const [hdr,p,k,keys] of [[anchor,parent.registry,'registry',[OWNER,EPOCH]],[anchor,parent.posting,'posting',[POST_NONCE]],[anchor,parent.owner,'wallet',[]],[h,finalPosting,'posting',[POST_NONCE]]]){
  const v=inspectHeaderBoundStateProof(JSON.stringify({header:hdr,proof:p}),JSON.stringify({schema:'caw-header-state-selection/1',profile:'shanghai-17',hash:hdr.hash,address:C[k].address,storageKeys:keys}));
  assert.equal(v.proof.codeHash,C[k].codeHash);
  const vals=Object.fromEntries(v.proof.storage.map(s=>[s.key,BigInt(s.value)]));
  if(k==='registry'){assert.equal(vals[OWNER],BigInt(before.owner));assert.equal(vals[EPOCH],BigInt(before.epoch))}
  if(k==='posting')assert.equal(vals[POST_NONCE],BigInt(hdr===anchor?before.nonce:after.nonce));
 }
 const bundle={schema:'local-posting-history/1',anchor,blocks:[{header:h,rawTransactions:raws,receipts,parent}],finalPosting};
 const selection={startHash:anchor.hash,endHash:h.hash,contracts:C,controller:addr};
 save('genuine-evidence',{bundle,selection,before,after,transactions,submitMs,headerHash:h.hash,transactionRoot:root2(...raws),receiptRoot:root2(...receipts.map(receiptBytes))});
 if(mode!=='positive'){
  for(const [name,fn] of [['offline reader',()=>verifyPostingHistory(bundle,selection)],['live reader',()=>acquireVerifiedPosts(rpc,cfg)]]){
   await assert.rejects(async()=>fn(),/POST_ONLY_BATCH_REQUIRED/);console.log(name,'POST_ONLY_BATCH_REQUIRED');
  }
 }else{
  const offline=verifyPostingHistory(bundle,selection);
  const live=await acquireVerifiedPosts(rpc,cfg);
  for(const v of [offline,live]){
   assert.deepEqual(v.posts.map(p=>p.text),texts);assert.deepEqual(v.posts.map(p=>p.nonce),['0','1']);
   assert.deepEqual(v.posts.map(p=>p.transactionHash),h.transactions);
   assert(v.posts.every(p=>p.author===before.owner&&p.epoch===before.epoch&&p.signer===addr));
  }
  save('reader',{offline,live});
  const results=[];
  for(const [name,mutate] of [
   ['missing raw',b=>b.blocks[0].rawTransactions.pop()],
   ['reordered raw',b=>b.blocks[0].rawTransactions.reverse()],
   ['missing receipt',b=>b.blocks[0].receipts.pop()],
   ['reordered receipt',b=>b.blocks[0].receipts.reverse()],
   ['modified receipt status',b=>b.blocks[0].receipts[1].status='0x0'],
   ['modified event epoch',b=>b.blocks[0].receipts[0].logs[0].topics[2]='0x'+'00'.repeat(32)],
   ['corrupt parent registry account proof',b=>b.blocks[0].parent.registry.accountProof[0]='0xc0'],
   ['corrupt final nonce proof',b=>b.finalPosting.storageProof[0].value='0x3']
  ]){
   const b=structuredClone(bundle);mutate(b);
   assert.throws(()=>verifyPostingHistory(b,selection),e=>{results.push({name,code:e.code??null,message:e.message});return true});
  }
  save('mutations',results);
 }
 console.log(JSON.stringify({mode,block:h.hash,number:h.number,submitMs,after,accepted:mode==='positive'}));
}finally{save('rpc-trace',trace)}
