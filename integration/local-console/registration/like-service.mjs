import {singlePostProof} from './single-post-proof.mjs';
import {verifyCredits} from './verify-action-credits.mjs';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {Contract,ContractFactory,Interface,JsonRpcProvider,ZeroAddress,ZeroHash,formatEther,getAddress,keccak256,parseEther,toQuantity} from 'ethers';
import solc from 'solc';
import {createLocalRpc} from '../local-rpc.mjs';

const upstream='http://127.0.0.1:34738';
async function postReader(path){
  const res=await fetch(upstream+path,{redirect:'error'});
  if(!res.ok)throw Error(await res.text());
  return res.json();
}
const cfg=await postReader('/config'),rpc=createLocalRpc(cfg.endpoint);
if(await rpc('eth_chainId',[])!=='0x539'||(await rpc('eth_getBlockByNumber',['latest',false])).number==='0x0')throw Error('Local chain required');
const follow=process.argv.includes('--follow');
const recaw=process.argv.includes('--recaw');
const action=follow?'follow':recaw?'recaw':'like', label=follow?'follow':recaw?'reCAW':'like', port=follow?34741:recaw?34740:34739;
const direct=follow?'24000':recaw?'2000':'1600', poolShare=follow?'6000':recaw?'2000':'400';
const known=recaw?await (await fetch('http://127.0.0.1:34739/config',{redirect:'error'})).json():null;
if(known && (known.posts!==cfg.posts||known.genesis!==cfg.genesis||known.registry!==cfg.registry))throw Error('Verifier deployment mismatch');
const provider=new JsonRpcProvider(cfg.endpoint),file=follow?'PaidFollows.sol':recaw?'PaidReCAWs.sol':'PaidLikes.sol';
const input={language:'Solidity',sources:{[file]:{content:await readFile(new URL(file,import.meta.url),'utf8')}},settings:{viaIR:true,optimizer:{enabled:true,runs:200},evmVersion:'shanghai',outputSelection:{'*':{'*':['abi','evm.bytecode.object']}}}};
if(recaw||follow)input.sources['PaidLikes.sol']={content:await readFile(new URL('PaidLikes.sol',import.meta.url),'utf8')};
const build=JSON.parse(solc.compile(JSON.stringify(input))),artifact=build.contracts?.[file]?.[follow?'PaidFollows':recaw?'PaidReCAWs':'PaidLikes'];
if(!artifact)throw Error(JSON.stringify(build.errors));
const abi=artifact.abi,iface=new Interface(abi);
const target=process.argv[2];
if(!target)throw Error('Supply --deploy or the existing local contract address');
const likes=target==='--deploy'?await new ContractFactory(abi,artifact.evm.bytecode.object,await provider.getSigner()).deploy(recaw?known.likes:cfg.posts):new Contract(getAddress(target),abi,provider);
await likes.waitForDeployment();
if(await likes.pool()!==cfg.posts)throw Error('Wrong posting pool');
if(recaw && await likes.source()!==known.likes)throw Error('Incorrect proof verifier');
const verifier=recaw?new Contract(known.likes,known.abi,provider):likes;
const config={...cfg,likes:likes.target,abi,action,label,direct,poolShare,fee:follow?'30000':recaw?'4000':'2000'};
const token=new Interface(['event Transfer(address indexed from,address indexed to,uint256 amount)']);
async function prepare(hash){
  const post=follow?null:await postReader('/post/'+hash);
  const latest=await rpc('eth_blockNumber',[]);
  const storage=i=>rpc('eth_getStorageAt',[cfg.posts,toQuantity(i),latest]);
  const count=Number(BigInt(await storage(0)));
  if(count>32)throw Error('Unexpected stake pool size');
  const first=BigInt(keccak256(ZeroHash)),members=[];
  for(let i=0;i<count;i++)members.push(getAddress('0x'+(await storage(first+BigInt(i))).slice(-40)));
  members.sort((a,b)=>a.toLowerCase().localeCompare(b.toLowerCase(),'en'));
  if(follow)return {members};
  let proof={height:0,header:'0x',txBytes:'0x',receipt:'0x'};
  if(await verifier.authorOf(hash)===ZeroAddress){
    proof=await singlePostProof(rpc,post,latest);
  }
  return {post,members,proof};
}
async function readLike(hash){
  const [tx,rc]=await Promise.all([provider.getTransaction(hash),provider.getTransactionReceipt(hash)]);
  if(!tx||!rc||rc.status!==1||tx.to!==likes.target)throw Error('No mined '+label+' at this hash.');
  const call=iface.parseTransaction({data:tx.data});
  const block=await rpc('eth_getBlockByNumber',[toQuantity(rc.blockNumber),false]);
  if(call?.name!==action||block.hash!==rc.blockHash||block.transactions[rc.index]!==tx.hash)throw Error('Like inclusion mismatch.');
  const [name,subject]=call.args;
  const requested=follow?call.args[3]:call.args[2];
  const events=rc.logs.filter(l=>l.address===likes.target).map(l=>iface.parseLog(l));
  const result=events.pop();
  if(result?.name!==(follow?'Followed':recaw?'ReCAWed':'Liked')||result.args.name!==name||result.args.payer!==tx.from||events.length!==requested.length)throw Error('Action event mismatch');
  const post=follow?null:await postReader('/post/'+subject);
  const recipient=follow?call.args[2]:post.author;
  if(follow?(result.args.target!==subject||result.args.recipient!==recipient||recipient===tx.from||recipient===ZeroAddress):(result.args.post!==subject||result.args.author!==recipient))throw Error('Target mismatch');
  const credits=verifyCredits({rc,tokenAddress:cfg.token,payer:tx.from,recipient,requested,events,eligible:result.args.eligible,direct,poolShare});
  const details=follow?{target:subject,recipient,accountCredit:direct}:{postHash:subject,body:post.body,author:recipient,authorCredit:direct};
  return {hash:tx.hash,name,payer:tx.from,...details,credits,block:rc.blockNumber};
}
const lib=resolve(dirname(createRequire(import.meta.url).resolve('ethers')),'../dist/ethers.min.js');
const files={'/':[follow?'follow.html':recaw?'recaw.html':'like.html','text/html'],'/follow.mjs':['follow.mjs','text/javascript'],'/like.mjs':['like.mjs','text/javascript'],'/ethers.mjs':[lib,'text/javascript'],'/styles.css':['../../../public/styles.css','text/css'],'/website.css':['../../../public/website.css','text/css']};
http.createServer(async(req,res)=>{
  if(req.headers.host!=='127.0.0.1:'+port||req.method!=='GET'){res.writeHead(403).end();return;}
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'");
  try{
    const pagePath=req.url.split('?')[0];if(Object.hasOwn(files,pagePath)){const [path,type]=files[pagePath];res.setHeader('Content-Type',type);res.end(await readFile(new URL(path,import.meta.url)));return;}
    if(follow && req.url==='/pool'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(await prepare()));return;}
    const m=/^\/(target|like|recaw|follow)\/(0x[0-9a-fA-F]{64})$/.exec(req.url);
    if((m && !['target',action].includes(m[1]))||(!m && req.url!=='/config')){res.writeHead(404).end();return;}
    const data=m?(m[1]==='target'?await prepare(m[2]):await readLike(m[2])):config;
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));
  }catch(e){res.writeHead(400,{'Content-Type':'text/plain'}).end(e.shortMessage||e.message);}
}).listen(port,'127.0.0.1',()=>console.log(label,likes.target));
