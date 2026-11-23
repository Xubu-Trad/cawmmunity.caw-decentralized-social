import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {formatEther,Contract,ContractFactory,Interface,JsonRpcProvider,getAddress,id,parseEther} from 'ethers';
import solc from 'solc';
import {createLocalRpc} from '../local-rpc.mjs';

const [endpoint,reg,existing,portArg='34738']=process.argv.slice(2);
const rpc=createLocalRpc(endpoint);
if(await rpc('eth_chainId',[])!=='0x539') throw Error('Local chain required');
const genesis=(await rpc('eth_getBlockByNumber',['0x0',false])).hash;
const provider=new JsonRpcProvider(endpoint);
provider.pollingInterval=200;
const registry=new Contract(getAddress(reg),['function paymentToken() view returns(address)'],provider);
const tokenAddress=await registry.paymentToken();
if(await new Contract(tokenAddress,['function symbol() view returns(string)'],provider).symbol()!=='FIX')throw Error('Registration fixture required');
const source=await readFile(new URL('StakedNamePosts.sol',import.meta.url),'utf8');
const compiled=JSON.parse(solc.compile(JSON.stringify({language:'Solidity',sources:{'StakedNamePosts.sol':{content:source}},settings:{evmVersion:'shanghai',outputSelection:{'*':{'*':['abi','evm.bytecode.object']}}}})));
const artifact=compiled.contracts?.['StakedNamePosts.sol']?.StakedNamePosts;
if(!artifact)throw Error(JSON.stringify(compiled.errors));
const iface=new Interface(artifact.abi);
let posts;
if(existing && existing!=='--deploy') posts=new Contract(getAddress(existing),iface,provider);
else if(existing==='--deploy'){
  posts=await new ContractFactory(iface,artifact.evm.bytecode.object,await provider.getSigner()).deploy(registry.target);
  await posts.waitForDeployment();
}else throw Error('Supply the existing posting contract or --deploy');
const fee=parseEther('5000');
if(await posts.registry()!==registry.target||await posts.token()!==tokenAddress||await posts.FEE()!==fee)throw Error('Wrong posting contract');
const config={endpoint,genesis,registry:registry.target,token:tokenAddress,posts:posts.target};
const transfer=new Interface(['event Transfer(address indexed from,address indexed to,uint256 value)']);
async function readPost(hash){
  const [tx,receipt]=await Promise.all([provider.getTransaction(hash),provider.getTransactionReceipt(hash)]);
  if(!tx||!receipt)throw Error('Transaction unknown or pending on this disposable chain.');
  if(receipt.status!==1||tx.to!==posts.target||tx.value!==0n||tx.blockHash!==receipt.blockHash)throw Error('Not a successful post to this registry.');
  const [name,body]=iface.decodeFunctionData('publish',tx.data);
  const postLogs=receipt.logs.filter(l=>l.address===posts.target && l.topics[0]===iface.getEvent('Published').topicHash);
  const payments=receipt.logs.filter(l=>l.address===tokenAddress && l.topics[0]===transfer.getEvent('Transfer').topicHash);
  if(postLogs.length!==1||payments.length<1)throw Error('Missing or ambiguous post or payment.');
  const e=iface.parseLog(postLogs[0]).args,t=transfer.parseLog(payments[0]).args;
  if(e.author!==tx.from||e.name!==name||e.body!==body||e.tokenId!==BigInt(id(name))||e.fee!==fee||t.from!==tx.from||t.to!==posts.target||t.value!==fee)throw Error('Mismatched post or payment.');
  const paid=receipt.logs.filter(l=>l.address===posts.target && l.topics[0]===iface.getEvent('StakerPaid').topicHash).map(l=>iface.parseLog(l).args);
  const totals=receipt.logs.filter(l=>l.address===posts.target && l.topics[0]===iface.getEvent('PoolSettled').topicHash);
  if(totals.length!==1 || !paid.length)throw Error('Missing settlement.');
  const {eligibleWeight,recipients}=iface.parseLog(totals[0]).args;
  let sum=0n,previous=0n,transferIndex=1;
  const credits=[],seen=new Set();
  for(const {staker,weight,amount} of paid){
    if(staker===tx.from||seen.has(staker)||weight<=0n||eligibleWeight<=0n)throw Error('Invalid staker.');
    seen.add(staker);sum+=weight;
    const next=fee*sum/eligibleWeight;
    if(amount!==next-previous)throw Error('Incorrect proportional credit.');
    previous=next;
    if(amount>0n){
      const log=payments[transferIndex++];
      const movement=log && transfer.parseLog(log).args;
      if(!movement||movement.from!==posts.target||movement.to!==staker||movement.value!==amount)throw Error('Missing token credit.');
    }
    credits.push({staker,weight:formatEther(weight),amount:formatEther(amount)});
  }
  if(sum!==eligibleWeight||previous!==fee||BigInt(paid.length)!==recipients||transferIndex!==payments.length)throw Error('Settlement totals differ.');
  const block=await rpc('eth_getBlockByNumber',[tx.blockNumber===0?'0x0':'0x'+tx.blockNumber.toString(16),false]);
  if(block?.hash!==receipt.blockHash||block.transactions[receipt.index]?.toLowerCase()!==hash.toLowerCase())throw Error('Block inclusion mismatch.');
  return {credits,name,body,author:tx.from,tokenId:e.tokenId.toString(),fee:'5,000 fixture CAW',hash:tx.hash,block:tx.blockNumber,blockHash:receipt.blockHash};
}
const port=Number(portArg),host='127.0.0.1:'+port;
const files=new Map([['/',['text/html','staked-post.html']],['/post.mjs',['text/javascript','staked-post.mjs']],['/ethers.mjs',['text/javascript',resolve(dirname(createRequire(import.meta.url).resolve('ethers')),'../dist/ethers.min.js')]],['/styles.css',['text/css','../../../public/styles.css']],['/website.css',['text/css','../../../public/website.css']]]);
http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'");
  if(req.headers.host!==host||req.method!=='GET'){res.writeHead(403).end();return;}
  try{
    if(req.url==='/config'||/^\/post\/0x[0-9a-fA-F]{64}$/.test(req.url)){
      res.setHeader('Content-Type','application/json');res.end(JSON.stringify(req.url==='/config'?config:await readPost(req.url.slice(6))));return;
    }
    const entry=files.get(req.url);if(!entry){res.writeHead(404).end();return;}
    res.setHeader('Content-Type',entry[0]);res.end(await readFile(new URL(entry[1],import.meta.url)));
  }catch(e){res.writeHead(400).end(e.shortMessage||e.message);}
}).listen(port,'127.0.0.1',()=>console.log(JSON.stringify(config)));
