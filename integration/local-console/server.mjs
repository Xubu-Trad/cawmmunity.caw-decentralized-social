import http from 'node:http';import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';import {Interface,keccak256,getAddress} from 'ethers';
const walletABI=new Interface(['function controller() view returns(address)','function execute(address,bytes) returns(bytes)']);
const registryABI=new Interface(['function authority(uint256) view returns(address,uint256)']);
const custodyABI=new Interface(['function credits(uint256) view returns(uint256)','function withdraw(uint256,uint256,uint256)']);
const tokenABI=new Interface(['function balanceOf(address) view returns(uint256)']);
const addr=x=>getAddress(x).toLowerCase();const hash=x=>{if(!/^0x[0-9a-f]{64}$/.test(x))throw Error('INVALID_HASH');return x;};
export function createConsole(config){
 const endpoint=new URL(config.rpcUrl);if(endpoint.protocol!=='http:'||endpoint.hostname!=='127.0.0.1'||endpoint.username||endpoint.password||endpoint.search||endpoint.hash)throw Error('LOCAL_RPC_REQUIRED');
 const genesisHash=hash(config.genesisHash);const names=['wallet','registry','custody','token'];const contracts=Object.fromEntries(names.map(n=>[n,addr(config.contracts[n].address)]));for(const n of names)hash(config.contracts[n].codeHash);
 if(new Set(Object.values(contracts)).size!==4)throw Error('DISTINCT_CONTRACTS_REQUIRED');
 const controller=addr(config.controller);let id=0;
 async function rpc(method,params){const rid=++id;const response=await fetch(endpoint,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:rid,method,params}),signal:AbortSignal.timeout(3000)});if(!response.ok)throw Error('RPC_HTTP');let size=0;const chunks=[];for await(const b of response.body){size+=b.length;if(size>131072)throw Error('RPC_LIMIT');chunks.push(b);}const value=JSON.parse(Buffer.concat(chunks));if(value.jsonrpc!=='2.0'||value.id!==rid||Object.hasOwn(value,'error')||!Object.hasOwn(value,'result'))throw Error('RPC_RESPONSE');return value.result;}
 async function snapshot(){
  if(await rpc('eth_chainId',[])!=='0x7a69')throw Error('WRONG_CHAIN');const genesis=await rpc('eth_getBlockByNumber',['0x0',false]);if(genesis?.hash!==genesisHash)throw Error('WRONG_GENESIS');
  const block=await rpc('eth_getBlockByNumber',['latest',false]);hash(block.hash);const at={blockHash:block.hash,requireCanonical:true};
  for(const n of names){const code=await rpc('eth_getCode',[contracts[n],at]);if(keccak256(code)!==config.contracts[n].codeHash)throw Error('WRONG_CODE_'+n);}
  async function call(n,abi,method,args=[]){const result=await rpc('eth_call',[{to:contracts[n],data:abi.encodeFunctionData(method,args)},at]);return abi.decodeFunctionResult(method,result);}
  const actualController=addr((await call('wallet',walletABI,'controller'))[0]);if(actualController!==controller)throw Error('WRONG_CONTROLLER');
  const [owner,epoch]=await call('registry',registryABI,'authority',[2]);const [credit]=await call('custody',custodyABI,'credits',[2]);const [walletBalance]=await call('token',tokenABI,'balanceOf',[contracts.wallet]);const [custodyBalance]=await call('token',tokenABI,'balanceOf',[contracts.custody]);
  return {status:'LOCAL_CHAIN_RESEARCH',genesisHash,chainId:'0x7a69',blockNumber:block.number,blockHash:block.hash,contracts,controller,owner:addr(owner),epoch:String(epoch),credit:String(credit),balances:{wallet:String(walletBalance),custody:String(custodyBalance)},publicChainAuthenticated:false};
 }
 async function plan(amount){if(typeof amount!=='string'||! /^[1-9][0-9]{0,77}$/.test(amount)||BigInt(amount)>2n**256n-1n)throw Error('INVALID_AMOUNT');const state=await snapshot();if(state.owner!==contracts.wallet)throw Error('WALLET_NOT_OWNER');if(BigInt(amount)>BigInt(state.credit))throw Error('INSUFFICIENT_CREDIT');return {chainId:state.chainId,from:controller,to:contracts.wallet,data:walletABI.encodeFunctionData('execute',[contracts.custody,custodyABI.encodeFunctionData('withdraw',[2,BigInt(state.epoch),BigInt(amount)])]),value:'0x0',amount,epoch:state.epoch,blockHash:state.blockHash,blockNumber:state.blockNumber,genesisHash};}
 const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'ui');const routes={'/':['index.html','text/html; charset=utf-8'],'/style.css':['style.css','text/css; charset=utf-8'],'/app.mjs':['app.mjs','text/javascript; charset=utf-8'],'/wallet-provider.mjs':['wallet-provider.mjs','text/javascript; charset=utf-8']};let busy=false;
 const server=http.createServer({maxHeaderSize:8192,requestTimeout:10000},async(req,res)=>{
  function send(status,value,type='application/json'){res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'"});res.end(type==='application/json'?JSON.stringify(value):value);}
  const origin='http://127.0.0.1:'+server.address().port;
  if(req.headers.host!==new URL(origin).host||req.headers.origin&&req.headers.origin!==origin)return send(403,{error:'LOCAL_ORIGIN_REQUIRED'});
  if(req.method==='GET'&&routes[req.url]){try{const [name,type]=routes[req.url];return send(200,await fs.readFile(path.join(root,name)),type);}catch{return send(503,{error:'UI_UNAVAILABLE'});}}
  if(!((req.method==='GET'&&req.url==='/api/state')||(req.method==='POST'&&req.url==='/api/withdrawal-plan')))return send(404,{error:'NOT_FOUND'});
  if(busy)return send(429,{error:'BUSY'});busy=true;
  try{if(req.method==='GET')return send(200,await snapshot());if(req.headers['content-type']!=='application/json')return send(415,{error:'JSON_REQUIRED'});let size=0;const parts=[];for await(const chunk of req){size+=chunk.length;if(size>1024)throw Error('BODY_LIMIT');parts.push(chunk);}const body=JSON.parse(Buffer.concat(parts));if(!body||Object.keys(body).join(',')!=='amount')throw Error('AMOUNT_ONLY');return send(200,await plan(body.amount));}
  catch(e){return send(422,{error:e.message});}finally{busy=false;}
 });return {server,snapshot,plan};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const config=JSON.parse(await fs.readFile(process.argv[2],'utf8'));const {server}=createConsole(config);server.listen(Number(process.env.PORT??4200),'127.0.0.1',()=>console.log('Local execution console: http://127.0.0.1:'+server.address().port));}


