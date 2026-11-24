import {singlePostProof} from './single-post-proof.mjs';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {Contract, JsonRpcProvider, getAddress, keccak256, parseEther} from 'ethers';
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {createLocalRpc} from '../local-rpc.mjs';

const [endpoint, address, portText = '34736'] = process.argv.slice(2);
const rpc = createLocalRpc(endpoint);
const port = Number(portText);
const host = '127.0.0.1:' + port;
const require = createRequire(import.meta.url);
const ethersFile = resolve(dirname(require.resolve('ethers')), '../dist/ethers.min.js');
const provider = new JsonRpcProvider(endpoint);
provider.pollingInterval = 150;
const genesis = (await rpc('eth_getBlockByNumber',['0x0',false])).hash;
async function checkChain() {
  if (await rpc('eth_chainId',[]) !== '0x539' ||
      (await rpc('eth_getBlockByNumber',['0x0',false])).hash !== genesis) throw Error('Disposable chain required');
}
await checkChain();
const registry = new Contract(getAddress(address), ['function paymentToken() view returns(address)','function SINK() view returns(address)'],provider);
const tokenAddress = await registry.paymentToken();
const sink = await registry.SINK();
const signer = process.env.CAW_OPERATOR_READ_ONLY==='1'?provider:await provider.getSigner();
const token = new Contract(tokenAddress,['function symbol() view returns(string)','function balanceOf(address) view returns(uint256)','function transfer(address,uint256) returns(bool)'],signer);
const actions=process.env.CAW_RUNTIME_ACTIONS ? JSON.parse(process.env.CAW_RUNTIME_ACTIONS) : null;
const binding=(address,signature)=>new Contract(getAddress(address),['function '+signature+'() view returns(address)'],provider)[signature]();
if(actions){
  const hash=keccak256(await provider.getCode(tokenAddress));
  if(hash!=='0x6ee560d3e6b1f881a8711e0be0b30a0e8e0cf8b915ce8f75ea05002126c94256' ||
    await binding(actions.posts,'registry')!==registry.target || await binding(actions.posts,'token')!==tokenAddress ||
    await binding(actions.vault,'registry')!==registry.target || await binding(actions.vault,'TOKEN')!==tokenAddress ||
    await binding(actions.recaw,'source')!==getAddress(actions.likes))throw Error('Runtime deployment mismatch');
  for(const address of [actions.likes,actions.recaw,actions.follow]){
    if(await binding(address,'pool')!==getAddress(actions.posts))throw Error('Action pool mismatch');
  }
}else if(await token.symbol()!=='FIX')throw Error('Wrong fixture token');
if(sink.toLowerCase()!=='0xdead000000000000000042069420694206942069')throw Error('Wrong sink');
const config = {endpoint, genesis, registry:registry.target, token:tokenAddress, sink, actions};
let funding = false;
const cap = parseEther(actions?'1100000':'1000000000000');
async function waitFunding(tx) {
  for (let i=0;i<120;i++) {
    const receipt=await rpc('eth_getTransactionReceipt',[tx.hash]);
    if(receipt){if(receipt.status!=='0x1')throw Error('Fixture funding reverted.');return;}
    await new Promise(done=>setTimeout(done,500));
  }
  throw Error('Fixture funding still pending: '+tx.hash);
}
async function fund(account) {
  if(process.env.CAW_OPERATOR_READ_ONLY==='1')throw Error('Funding disabled in operator verification mode.');
  if (funding) throw Error('Another fixture request is pending. Try again.');
  funding = true;
  try {
    await checkChain();
    const eth = await provider.send('eth_getBalance',[account,'latest']);
    if (BigInt(eth) < parseEther('0.01')) await waitFunding(await signer.sendTransaction({to:account,value:parseEther('0.02')}));
    const balance = await token.balanceOf(account);
    if (balance < cap) await waitFunding(await token.transfer(account,cap-balance));
  } finally { funding = false; }
}
const files = new Map([['/runtime-actions.mjs',['text/javascript','./runtime-actions.mjs']],['/', ['text/html','./wallet.html']],['/wallet.mjs',['text/javascript','./wallet.mjs']],['/ethers.mjs',['text/javascript',ethersFile]],['/website.css',['text/css','../../../public/website.css']],['/styles.css',['text/css','../../../public/styles.css']]]);
http.createServer(async (req,res) => {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'");
  try {
    if (req.headers.host !== host || (req.headers.origin && req.headers.origin !== 'http://'+host)) {res.writeHead(403).end();return;}
    if(actions && req.method==='GET' && /^\/proof\/0x[0-9a-fA-F]{64}$/.test(req.url)){
      const hash=req.url.slice(7),rc=await provider.getTransactionReceipt(hash);
      if(rc?.status!==1 || rc.to!==getAddress(actions.posts))throw Error('Unknown post receipt');
      const proof=await singlePostProof(rpc,{hash,blockHash:rc.blockHash,block:rc.blockNumber},await rpc('eth_blockNumber',[]));
      res.setHeader('Content-Type','application/json');res.end(JSON.stringify(proof));return;
    }
    if (req.method === 'GET' && req.url === '/config') {res.setHeader('Content-Type','application/json');res.end(JSON.stringify(config));return;}
    if (req.method === 'POST' && /^\/fund\/0x[0-9a-fA-F]{40}$/.test(req.url) && req.headers.origin === 'http://'+host && req.headers['x-local-fixture'] === '1') {
      await fund(getAddress(req.url.slice(6)));res.end('Fixture funds ready.');return;
    }
    if (req.method !== 'GET' || !files.has(req.url)) {res.writeHead(404).end();return;}
    const [type,file] = files.get(req.url);
    res.setHeader('Content-Type',type);
    res.end(await readFile(file.startsWith('/') ? file : new URL(file,import.meta.url)));
  } catch (e) {res.writeHead(400).end(e.shortMessage || e.message);}
}).listen(port,'127.0.0.1',()=>console.log('Registration portal: http://'+host));
