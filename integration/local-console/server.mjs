import http from 'node:http';import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';import {Interface,keccak256,getAddress} from 'ethers';
import {postText,POST_PROFILE} from './ui/post-plan.mjs';
const postingABI=new Interface(['function registry() view returns(address)','function registryCodeHash() view returns(bytes32)','function PROFILE() view returns(bytes32)','function nextNonce(uint256) view returns(uint256)','function publish(uint256,uint256,uint256,bytes)','event LocalPostPublished(uint256 indexed accountId,uint256 indexed epoch,uint256 indexed nonce,address author,bytes32 textHash,bytes text)']);
const walletABI=new Interface(['function controller() view returns(address)','function execute(address,bytes) returns(bytes)']);
const registryABI=new Interface(['function authority(uint256) view returns(address,uint256)','function safeTransferFrom(address,address,uint256)']);
const custodyABI=new Interface(['function credits(uint256) view returns(uint256)','function withdraw(uint256,uint256,uint256)']);
const tokenABI=new Interface(['function balanceOf(address) view returns(uint256)']);
const addr=x=>getAddress(x).toLowerCase();const hash=x=>{if(!/^0x[0-9a-f]{64}$/.test(x))throw Error('INVALID_HASH');return x;};
export function createConsole(config){
 const endpoint=new URL(config.rpcUrl);if(endpoint.protocol!=='http:'||endpoint.hostname!=='127.0.0.1'||endpoint.username||endpoint.password||endpoint.search||endpoint.hash)throw Error('LOCAL_RPC_REQUIRED');
 const genesisHash=hash(config.genesisHash);const names=['wallet','registry','custody','token','posting'];const contracts=Object.fromEntries(names.map(n=>[n,addr(config.contracts[n].address)]));for(const n of names)hash(config.contracts[n].codeHash);
 if(new Set(Object.values(contracts)).size!==5)throw Error('DISTINCT_CONTRACTS_REQUIRED');
 const creation=config.postingDeployment;if(!creation||!/^0x(?:0|[1-9a-f][0-9a-f]*)$/.test(creation.blockNumber))throw Error('POSTING_CREATION_REQUIRED');hash(creation.blockHash);hash(creation.transactionHash);
 const controller=addr(config.controller);let id=0;
 async function rpc(method,params){const rid=++id;const response=await fetch(endpoint,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:rid,method,params}),signal:AbortSignal.timeout(3000)});if(!response.ok)throw Error('RPC_HTTP');let size=0;const chunks=[];for await(const b of response.body){size+=b.length;if(size>131072)throw Error('RPC_LIMIT');chunks.push(b);}const value=JSON.parse(Buffer.concat(chunks));if(value.jsonrpc!=='2.0'||value.id!==rid||Object.hasOwn(value,'error')||!Object.hasOwn(value,'result'))throw Error('RPC_RESPONSE');return value.result;}
 async function snapshot(){
  if(await rpc('eth_chainId',[])!=='0x7a69')throw Error('WRONG_CHAIN');const genesis=await rpc('eth_getBlockByNumber',['0x0',false]);if(genesis?.hash!==genesisHash)throw Error('WRONG_GENESIS');
  const block=await rpc('eth_getBlockByNumber',['latest',false]);hash(block.hash);const at={blockHash:block.hash,requireCanonical:true};
  for(const n of names){const code=await rpc('eth_getCode',[contracts[n],at]);if(keccak256(code)!==config.contracts[n].codeHash)throw Error('WRONG_CODE_'+n);}
  async function call(n,abi,method,args=[]){const result=await rpc('eth_call',[{to:contracts[n],data:abi.encodeFunctionData(method,args)},at]);return abi.decodeFunctionResult(method,result);}
  const actualController=addr((await call('wallet',walletABI,'controller'))[0]);if(actualController!==controller)throw Error('WRONG_CONTROLLER');
  if(addr((await call('posting',postingABI,'registry'))[0])!==contracts.registry||(await call('posting',postingABI,'registryCodeHash'))[0]!==config.contracts.registry.codeHash||(await call('posting',postingABI,'PROFILE'))[0]!==POST_PROFILE)throw Error('POSTING_BINDING');
  const created=await rpc('eth_getTransactionReceipt',[creation.transactionHash]);const creationBlock=await rpc('eth_getBlockByNumber',[creation.blockNumber,false]);
  if(!created||created.status!=='0x1'||created.to!==null||addr(created.contractAddress)!==contracts.posting||created.transactionHash!==creation.transactionHash||created.blockHash!==creation.blockHash||created.blockNumber!==creation.blockNumber||creationBlock?.hash!==creation.blockHash||BigInt(block.number)<BigInt(creation.blockNumber))throw Error('POSTING_CREATION_MISMATCH');
  const [postNonce]=await call('posting',postingABI,'nextNonce',[2]);
  const [owner,epoch]=await call('registry',registryABI,'authority',[2]);const [credit]=await call('custody',custodyABI,'credits',[2]);const [walletBalance]=await call('token',tokenABI,'balanceOf',[contracts.wallet]);const [custodyBalance]=await call('token',tokenABI,'balanceOf',[contracts.custody]);
  const ownerAddress=addr(owner),ownerCode=await rpc('eth_getCode',[ownerAddress,at]);
  const ownerType=ownerAddress===contracts.wallet?'fixture-wallet':ownerCode==='0x'&&BigInt(ownerAddress)>0xffffn?'eoa':'unsupported';
  const [ownerBalance]=await call('token',tokenABI,'balanceOf',[ownerAddress]);
  return {status:'LOCAL_CHAIN_RESEARCH',genesisHash,chainId:'0x7a69',blockNumber:block.number,blockHash:block.hash,contracts,controller,owner:ownerAddress,ownerType,signer:ownerType==='fixture-wallet'?controller:ownerType==='eoa'?ownerAddress:null,epoch:String(epoch),credit:String(credit),balances:{wallet:String(walletBalance),owner:String(ownerBalance),custody:String(custodyBalance)},posting:{nonce:String(postNonce),profile:POST_PROFILE},publicChainAuthenticated:false};
 }
 function actionPlan(state,target,data){if(!state.signer)throw Error('UNSUPPORTED_ACCOUNT_OWNER');return {chainId:state.chainId,from:state.signer,to:state.ownerType==='fixture-wallet'?contracts.wallet:target,data:state.ownerType==='fixture-wallet'?walletABI.encodeFunctionData('execute',[target,data]):data,value:'0x0',epoch:state.epoch,blockHash:state.blockHash,blockNumber:state.blockNumber,genesisHash};}
 async function plan(amount){if(typeof amount!=='string'||! /^[1-9][0-9]{0,77}$/.test(amount)||BigInt(amount)>2n**256n-1n)throw Error('INVALID_AMOUNT');const state=await snapshot();if(BigInt(amount)>BigInt(state.credit))throw Error('INSUFFICIENT_CREDIT');return {...actionPlan(state,contracts.custody,custodyABI.encodeFunctionData('withdraw',[2,BigInt(state.epoch),BigInt(amount)])),amount};}
 async function transferPlan(recipient){const to=addr(recipient),state=await snapshot();if(BigInt(to)<=0xffffn||to===state.owner||Object.values(contracts).includes(to))throw Error('INVALID_RECIPIENT');if(await rpc('eth_getCode',[to,{blockHash:state.blockHash,requireCanonical:true}])!=='0x')throw Error('RECIPIENT_MUST_BE_PLAIN_WALLET');return {...actionPlan(state,contracts.registry,registryABI.encodeFunctionData('safeTransferFrom',[state.owner,to,2])),action:'transfer',recipient:to,owner:state.owner,registry:contracts.registry};}
 async function postPlan(text){const encoded=postText(text),state=await snapshot();return {...actionPlan(state,contracts.posting,postingABI.encodeFunctionData('publish',[2,BigInt(state.epoch),BigInt(state.posting.nonce),encoded.bytesHex])),action:'post',owner:state.owner,posting:contracts.posting,postNonce:state.posting.nonce,text,textHash:encoded.textHash,profile:POST_PROFILE};}
 async function posts(){
  const state=await snapshot();if(BigInt(state.blockNumber)-BigInt(creation.blockNumber)>1024n||BigInt(state.posting.nonce)>128n)throw Error('LOCAL_HISTORY_LIMIT');
  const logs=await rpc('eth_getLogs',[{address:contracts.posting,fromBlock:creation.blockNumber,toBlock:state.blockNumber,topics:[postingABI.getEvent('LocalPostPublished').topicHash,'0x'+'2'.padStart(64,'0')]}]);
  if(!Array.isArray(logs)||logs.length>128||BigInt(logs.length)!==BigInt(state.posting.nonce))throw Error('INCOMPLETE_POST_HISTORY');
  const rows=[],blocks=new Map();let previousBlock=-1n,previousIndex=-1n;
  for(const log of logs){
   if(!log||log.removed!==false||addr(log.address)!==contracts.posting||!/^0x(?:0|[1-9a-f][0-9a-f]*)$/.test(log.blockNumber)||!/^0x(?:0|[1-9a-f][0-9a-f]*)$/.test(log.logIndex))throw Error('INVALID_POST_LOG');
   hash(log.blockHash);hash(log.transactionHash);const height=BigInt(log.blockNumber),index=BigInt(log.logIndex);
   if(height<BigInt(creation.blockNumber)||height>BigInt(state.blockNumber)||height<previousBlock||height===previousBlock&&index<=previousIndex)throw Error('POST_LOG_ORDER');previousBlock=height;previousIndex=index;
   if(!blocks.has(log.blockNumber))blocks.set(log.blockNumber,(await rpc('eth_getBlockByNumber',[log.blockNumber,false]))?.hash);
   if(blocks.get(log.blockNumber)!==log.blockHash)throw Error('POST_HISTORY_REORG');
   const decoded=postingABI.parseLog(log);if(decoded.name!=='LocalPostPublished'||decoded.args.accountId!==2n||decoded.args.nonce!==BigInt(rows.length))throw Error('POST_NONCE_GAP');
   const canonical=postingABI.encodeEventLog(postingABI.getEvent('LocalPostPublished'),Array.from(decoded.args));if(log.data.toLowerCase()!==canonical.data.toLowerCase()||JSON.stringify(log.topics.map(x=>x.toLowerCase()))!==JSON.stringify(canonical.topics.map(x=>x.toLowerCase())))throw Error('POST_LOG_ENCODING');
   const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(Buffer.from(decoded.args.text.slice(2),'hex'));const encoded=postText(text);
   if(encoded.bytesHex.toLowerCase()!==decoded.args.text.toLowerCase()||encoded.textHash!==decoded.args.textHash)throw Error('POST_TEXT_MISMATCH');
   rows.push({accountId:'2',epoch:String(decoded.args.epoch),nonce:String(decoded.args.nonce),author:addr(decoded.args.author),text,textHash:encoded.textHash,transactionHash:log.transactionHash,blockHash:log.blockHash,blockNumber:log.blockNumber});
  }
  if((await rpc('eth_getBlockByNumber',[state.blockNumber,false]))?.hash!==state.blockHash)throw Error('POST_HISTORY_REORG');
  return {status:state.status,blockNumber:state.blockNumber,blockHash:state.blockHash,genesisHash,posting:contracts.posting,posts:rows,publicChainAuthenticated:false};
 }
 const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'ui');const routes={'/':['index.html','text/html; charset=utf-8'],'/style.css':['style.css','text/css; charset=utf-8'],'/app.mjs':['app.mjs','text/javascript; charset=utf-8'],'/wallet-provider.mjs':['wallet-provider.mjs','text/javascript; charset=utf-8'],'/withdrawal-plan.mjs':['withdrawal-plan.mjs','text/javascript; charset=utf-8'],'/account-transfer-plan.mjs':['account-transfer-plan.mjs','text/javascript; charset=utf-8'],'/post-plan.mjs':['post-plan.mjs','text/javascript; charset=utf-8'],'/keccak256.mjs':['keccak256.mjs','text/javascript; charset=utf-8'],'/receipt-status.mjs':['receipt-status.mjs','text/javascript; charset=utf-8'],'/withdrawal-journal.mjs':['withdrawal-journal.mjs','text/javascript; charset=utf-8']};let busy=false;
 const server=http.createServer({maxHeaderSize:8192,requestTimeout:10000},async(req,res)=>{
  function send(status,value,type='application/json'){res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'"});res.end(type==='application/json'?JSON.stringify(value):value);}
  const origin='http://127.0.0.1:'+server.address().port;
  if(req.headers.host!==new URL(origin).host||req.headers.origin&&req.headers.origin!==origin)return send(403,{error:'LOCAL_ORIGIN_REQUIRED'});
  if(req.method==='GET'&&routes[req.url]){try{const [name,type]=routes[req.url];return send(200,await fs.readFile(path.join(root,name)),type);}catch{return send(503,{error:'UI_UNAVAILABLE'});}}
  if(!((req.method==='GET'&&['/api/state','/api/posts'].includes(req.url))||(req.method==='POST'&&['/api/withdrawal-plan','/api/transfer-plan','/api/post-plan'].includes(req.url))))return send(404,{error:'NOT_FOUND'});
  if(busy)return send(429,{error:'BUSY'});busy=true;
  try{if(req.method==='GET')return send(200,req.url==='/api/posts'?await posts():await snapshot());if(req.headers['content-type']!=='application/json')return send(415,{error:'JSON_REQUIRED'});let size=0;const parts=[];for await(const chunk of req){size+=chunk.length;if(size>12288)throw Error('BODY_LIMIT');parts.push(chunk);}const body=JSON.parse(Buffer.concat(parts));const field=req.url==='/api/transfer-plan'?'recipient':req.url==='/api/post-plan'?'text':'amount';if(!body||Object.keys(body).join(',')!==field)throw Error('ONE_FIELD_REQUIRED');return send(200,field==='recipient'?await transferPlan(body.recipient):field==='text'?await postPlan(body.text):await plan(body.amount));}
  catch(e){return send(422,{error:e.message});}finally{busy=false;}
 });return {server,snapshot,plan,transferPlan,postPlan,posts};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const config=JSON.parse(await fs.readFile(process.argv[2],'utf8'));const {server}=createConsole(config);server.listen(Number(process.env.PORT??4200),'127.0.0.1',()=>console.log('Local execution console: http://127.0.0.1:'+server.address().port));}


