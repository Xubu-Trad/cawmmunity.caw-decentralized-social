import fs from 'node:fs/promises';import {POST_NONCE}from './verify-posting-history.mjs';
const[cfg,out]=process.argv.slice(2),c=JSON.parse(await fs.readFile(cfg));const u=new URL(c.rpcUrl);if(u.hostname!=='127.0.0.1'||u.protocol!=='http:')throw Error('LOCAL_ONLY');await fs.mkdir(out);
let id=0;async function rpc(method,params){let n=++id;const r=await fetch(u,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:n,method,params}),signal:AbortSignal.timeout(5000)});const v=await r.json();if(v.id!==n||v.jsonrpc!=='2.0'||'error'in v||!('result'in v))throw Error('RPC_RESPONSE');return v.result;}
const ownerKey='0xabbb5caa7dda850e60932de0934eb1f9d0f59695050f761dc64e443e5030a569',epochKey='0x91da3fd0782e51c6b3986e9e672fd566868e71f3dbc2d6c2cd6fbb3e361af2a7';
const anchor=await rpc('eth_getBlockByNumber',[c.postingDeployment.blockNumber,false]),tip=await rpc('eth_getBlockByNumber',['latest',false]);if(anchor.hash!==c.postingDeployment.blockHash||BigInt(tip.number)-BigInt(anchor.number)>128n)throw Error('SELECTION');
const bundle={schema:'local-posting-history/1',anchor,blocks:[]};let prior=anchor;
for(let n=BigInt(anchor.number)+1n;n<=BigInt(tip.number);n++){
 const h=await rpc('eth_getBlockByNumber',['0x'+n.toString(16),false]);const registry=await rpc('eth_getProof',[c.contracts.registry.address,[ownerKey,epochKey],prior.number]);const owner='0x'+BigInt(registry.storageProof.find(x=>x.key===ownerKey).value).toString(16).padStart(40,'0');
 const parent={registry,posting:await rpc('eth_getProof',[c.contracts.posting.address,[POST_NONCE],prior.number]),owner:await rpc('eth_getProof',[owner,[],prior.number])};
 const raws=[],receipts=[];for(const tx of h.transactions){raws.push(await rpc('eth_getRawTransactionByHash',[tx]));receipts.push(await rpc('eth_getTransactionReceipt',[tx]));}
 bundle.blocks.push({header:h,rawTransactions:raws,receipts,parent});prior=h;
}
bundle.finalPosting=await rpc('eth_getProof',[c.contracts.posting.address,[POST_NONCE],tip.number]);if((await rpc('eth_getBlockByNumber',[tip.number,false])).hash!==tip.hash)throw Error('REORG');
await fs.writeFile(out+'/capture.json',JSON.stringify(bundle,null,2));await fs.writeFile(out+'/selection.json',JSON.stringify({startHash:anchor.hash,endHash:tip.hash,contracts:c.contracts,controller:c.controller,scope:'Operator-selected local endpoints and reviewed code/layout; not public-chain authentication.'},null,2));
