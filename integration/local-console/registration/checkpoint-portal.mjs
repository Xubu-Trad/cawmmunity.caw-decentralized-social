import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {keccak256} from 'ethers';
import {readJsonBody,createLocalRpc} from '../local-rpc.mjs';
import {parseBoundedJson} from '../../../public/bounded-json.mjs';
import {captureLocatedPost} from './locate-archived-post.mjs';
import {recheckFeed} from './recheck-feed.mjs';

const addr='127.0.0.1:34742';
const assets=new Map([
  ['/checkpoint',['checkpoint.html','text/html']], ['/checkpoint/ui.mjs',['checkpoint-ui.mjs','text/javascript']],
  ['/checkpoint/style.css',['../../../public/styles.css','text/css']], ['/checkpoint/portal.css',['../../../public/website.css','text/css']]
]);
const load=file=>readFile(new URL(file,import.meta.url),'utf8');
export async function serveCheckpointPortal(req,res,rpc,expectedHost=addr){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'");
  if(req.headers.host!==expectedHost){res.writeHead(403).end();return;}
  try{
    const path=req.url.split('?')[0];
    if(req.method==='GET' && assets.has(path)){
      const [file,type]=assets.get(path);res.setHeader('Content-Type',type);res.end(await load(file));return;
    }
    res.setHeader('Content-Type','application/json');
    if(req.method==='GET' && path==='/checkpoint/config'){res.end(JSON.stringify({live:!!rpc}));return;}
    if(req.method==='GET' && path==='/checkpoint/example'){
      const files=await Promise.all(['branch-check/archive','peer-check/located'].map(name=>load('samples/'+name+'.json')));
      res.end(JSON.stringify({checkpoint:'0x3ae8c74183bc3aae8e9e2dd27aad137ac6960f33d745a4ecd3c7ef61c68d06ae',files}));return;
    }
    if(req.method!=='POST'||path!=='/checkpoint/verify'){res.writeHead(404).end();return;}
    if(req.headers.origin!=='http://'+expectedHost || req.headers['content-type']!=='application/json'){res.writeHead(403).end();return;}
    const {files,checkpoint,height,live}=await readJsonBody(req,1048576,'Selection exceeds 1 MiB.');
    if(!Array.isArray(files)||files.length<2||files.length>64||!/^0x[0-9a-f]{64}$/.test(checkpoint))throw Error('Select archives, packets and a lowercase checkpoint hash.');
    const archives=new Map(), packets=[];
    for(const raw of files){
      const item=parseBoundedJson(raw,1048576);
      if(Object.hasOwn(item,'header')){
        const hash=keccak256(item.header);
        if(archives.has(hash))throw Error('Duplicate block archive.');
        archives.set(hash,item);
      }else packets.push(item);
    }
    if(!packets.length||packets.length>32)throw Error('Select 1–32 post packets.');
    const entries=[],used=new Set();
    for(const packet of packets){
      const {originalBlockHash:block,transactionHash:tx}=packet;
      const archive=archives.get(block);
      if(!archive)throw Error('Missing original archive for '+block);
      if(live && !rpc)throw Error('A local node is required for fresh evidence.');
      const evidence=live?await captureLocatedPost(rpc,archive,block,tx,height):packet;
      if(evidence.checkpointHash!==checkpoint)throw Error('Checkpoint mismatch. Review the selected hash.');
      entries.push({block,tx,archive,packet:evidence});used.add(block);
    }
    if(used.size!==archives.size)throw Error('An archive has no matching packet.');
    const result=recheckFeed(checkpoint,entries,{includeArchivedCredits:true});
    if(live){
      const finalBlock=await rpc('eth_getBlockByNumber',[height,false]);
      if(finalBlock?.hash!==checkpoint || finalBlock.number!==height)
        throw Error('Checkpoint hash or height changed. Recheck the feed.');
    }
    res.end(JSON.stringify(result));
  }catch(error){res.writeHead(400,{'Content-Type':'text/plain'}).end(error.message);}
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  const rpc=process.argv[2]?createLocalRpc(process.argv[2]):null;
  http.createServer((req,res)=>serveCheckpointPortal(req,res,rpc)).listen(34742,'127.0.0.1',()=>console.log('Open http://'+addr+'/checkpoint'));
}
