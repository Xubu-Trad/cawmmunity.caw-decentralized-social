import {serveCheckpointPortal} from './checkpoint-portal.mjs';
import {renderSnapshot} from './feed-export.mjs';
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {Interface,ZeroAddress,id,toQuantity} from 'ethers';
import {createLocalRpc} from '../local-rpc.mjs';

const origins={post:'http://127.0.0.1:34738',recaw:'http://127.0.0.1:34740',follow:'http://127.0.0.1:34741'};
async function read(kind,path){
  const response=await fetch(origins[kind]+path,{redirect:'error',signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error('The local '+kind+' reader could not verify this request.');
  return response.json();
}
origins.like='http://127.0.0.1:34739';
const [posts,recaws,follows,likes]=await Promise.all(Object.keys(origins).map(kind=>read(kind,'/config')));
for(const cfg of [recaws,follows,likes]){
  for(const key of ['endpoint','genesis','registry','posts','token']){
    if(cfg[key]!==posts[key])throw Error('Readers disagree about the local deployment.');
  }
}
if(recaws.action!=='recaw'||follows.action!=='follow')throw Error('Unexpected local reader');
const rpc=createLocalRpc(posts.endpoint);
const registry=new Interface(['function lookup(string) view returns(uint256,address)']);
const specs=[
  ['follow',follows.likes,new Interface(follows.abi),'Followed'],
  ['post',posts.posts,new Interface(['event Published(uint256 indexed tokenId,address indexed author,string name,string body,uint256 fee)']),'Published'],
  ['recaw',recaws.likes,new Interface(recaws.abi),'ReCAWed']
];
async function* events(spec,height){
  const [,address,iface,event]=spec;
  for(let first=0;first<=height;first+=16){
    const logs=await rpc('eth_getLogs',[{address,topics:[iface.getEvent(event).topicHash],fromBlock:toQuantity(first),toBlock:toQuantity(Math.min(first+15,height))}]);
    for(const log of logs){
      if(log.removed||log.address.toLowerCase()!==address.toLowerCase())throw Error('Chain changed. Refresh the feed.');
      yield {args:iface.parseLog(log).args,hash:log.transactionHash,height:Number(BigInt(log.blockNumber)),index:Number(BigInt(log.logIndex))};
    }
  }
}
async function feed(name,tag='latest',expectedHash){
  const [genesis,head,chain]=await Promise.all([rpc('eth_getBlockByNumber',['0x0',false]),rpc('eth_getBlockByNumber',[tag,false]),rpc('eth_chainId',[])]);
  if(chain!=='0x539'||genesis.hash!==posts.genesis)throw Error('Wrong disposable chain.');
  if(!head||(expectedHash && head.hash!==expectedHash))throw Error('Pinned block missing or noncanonical on operator node.');
  const at={blockHash:head.hash,requireCanonical:true};
  const raw=await rpc('eth_call',[{to:posts.registry,data:registry.encodeFunctionData('lookup',[name])},at]);
  if(registry.decodeFunctionResult('lookup',raw)[1]===ZeroAddress)throw Error('Username is unregistered on this chain.');
  const height=Number(BigInt(head.number)),targets=new Set(),items=[];
  for await(const event of events(specs[0],height)){
    if(event.args.name!==name)continue;
    const receipt=await read('follow','/follow/'+event.hash);
    if(receipt.name!==name||receipt.target!==event.args.target||receipt.hash!==event.hash||receipt.block!==event.height)throw Error('Follow receipt mismatch.');
    targets.add(receipt.target);
  }
  if(targets.size){
    for(const spec of specs.slice(1)){
      const kind=spec[0];
      for await(const event of events(spec,height)){
        if(!targets.has(event.args.name))continue;
        const receipt=await read(kind,'/'+kind+'/'+event.hash);
        if(receipt.name!==event.args.name||receipt.hash!==event.hash||receipt.block!==event.height)throw Error('Activity receipt mismatch.');
        const item={originalHash:receipt.postHash||receipt.hash,originalName:receipt.name,kind,name:receipt.name,body:receipt.body,hash:event.hash,block:event.height,index:event.index,url:origins[kind]+'/#'+event.hash};
        if(kind==='recaw'){
          const original=await read('post','/post/'+receipt.postHash);
          if(original.hash!==event.args.post||original.body!==receipt.body||original.author!==receipt.author)throw Error('Original post mismatch.');
          item.originalName=original.name;item.originalUrl=origins.post+'/#'+original.hash;
        }
        items.push(item);
      }
    }
  }

  const sourceHashes=new Set(items.map(i=>i.originalHash));
  const history=new Map();
  if(sourceHashes.size){
    for(const spec of [['like',likes.likes,new Interface(likes.abi),'Liked'],specs[2]]){
      const kind=spec[0];
      for await(const e of events(spec,height)){
        if(e.args.name!==name||!sourceHashes.has(e.args.post))continue;
        const receipt=await read(kind,'/'+kind+'/'+e.hash);
        if(receipt.postHash!==e.args.post||receipt.name!==name||receipt.hash!==e.hash||receipt.block!==e.height)throw Error('Action receipt mismatch.');
        const actions=history.get(receipt.postHash)||{};
        actions[kind]=origins[kind]+'/#'+receipt.hash;history.set(receipt.postHash,actions);
      }
    }
  }
  for(const i of items)i.actions=history.get(i.originalHash)||{};
  if((await rpc('eth_getBlockByNumber',[head.number,false]))?.hash!==head.hash)throw Error('Chain changed. Refresh the feed.');
  items.sort((a,b)=>b.block-a.block||b.index-a.index);
  return {name,block:height,blockHash:head.hash,following:targets.size,items};
}
const lib=resolve(dirname(createRequire(import.meta.url).resolve('ethers')),'../dist/ethers.min.js');
const files={'/ethers.mjs':[lib,'text/javascript'],'/feed-actions.mjs':['feed-actions.mjs','text/javascript'],'/':['feed.html','text/html'],'/feed.mjs':['feed.mjs','text/javascript'],'/styles.css':['../../../public/styles.css','text/css'],'/website.css':['../../../public/website.css','text/css']};
http.createServer(async(req,res)=>{
  if (req.url.split('?')[0].startsWith('/checkpoint')) { await serveCheckpointPortal(req,res,rpc); return; }
  if(req.headers.host!=='127.0.0.1:34742'||req.method!=='GET'){res.writeHead(403).end();return;}
  res.setHeader('Cache-Control','no-store');res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'");
  try{
    const path=req.url.split('?')[0];
    if(Object.hasOwn(files,path)){const [file,type]=files[path];res.setHeader('Content-Type',type);res.end(await readFile(new URL(file,import.meta.url)));return;}
    const action=/^\/action\/(like|recaw)\/(config|(?:target|like|recaw)\/0x[0-9a-fA-F]{64})$/.exec(path);
    if(action){
      const [,kind,route]=action;
      if(route!=='config' && !route.startsWith('target/') && !route.startsWith(kind+'/'))throw Error('Invalid receipt type.');
      const data=route==='config'?(kind==='like'?likes:recaws):await read(kind,'/'+route);
      res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));return;
    }
    const download=/^\/download\/([a-z0-9]+)\.html$/.exec(path);
    const pinned=/^\/reproduce\/([a-z0-9]+)\/(\d{1,12})\/(0x[0-9a-f]{64})$/.exec(path);
    if(download||pinned){
      const snapshot=(pinned?await feed(pinned[1],toQuantity(BigInt(pinned[2])),pinned[3]):await feed(download[1])),records=new Map();
      async function capture(kind,hash){
        const key=kind+'/'+hash;
        if(records.has(key))return;
        const receipt=await read(kind,'/'+key);
        if(receipt.hash!==hash||receipt.block>snapshot.block)throw Error('Export receipt mismatch.');
        records.set(key,receipt);
      }
      for(const item of snapshot.items){
        await capture(item.kind,item.hash);
        if(item.kind==='recaw')await capture('post',item.originalHash);
        for(const [kind,url] of Object.entries(item.actions))await capture(kind,url.split('#')[1]);
      }
      if((await rpc('eth_getBlockByNumber',[toQuantity(snapshot.block),false]))?.hash!==snapshot.blockHash)throw Error('Chain changed during export.');
      const html=renderSnapshot(snapshot,posts,records);
      res.setHeader('Content-Disposition','attachment; filename="community-caw-'+snapshot.name+'-'+snapshot.block+'.html"');
      res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);return;
    }
    const m=/^\/feed\/([a-z0-9]+)$/.exec(path);
    if(!m){res.writeHead(404).end();return;}
    const result=await feed(m[1]);
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));
  }catch(e){res.writeHead(400,{'Content-Type':'text/plain'}).end(e.message);}
}).listen(34742,'127.0.0.1');
