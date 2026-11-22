import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {Contract, JsonRpcProvider, getAddress, parseEther} from 'ethers';
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
const signer = await provider.getSigner();
const token = new Contract(tokenAddress,['function symbol() view returns(string)','function balanceOf(address) view returns(uint256)','function transfer(address,uint256) returns(bool)'],signer);
if (await token.symbol() !== 'FIX' || sink.toLowerCase() !== '0xdead000000000000000042069420694206942069') throw Error('Wrong fixture');
const config = {endpoint, genesis, registry:registry.target, token:tokenAddress, sink};
let funding = false;
const cap = parseEther('1000000000000');
async function fund(account) {
  if (funding) throw Error('Another fixture request is pending. Try again.');
  funding = true;
  try {
    await checkChain();
    const eth = await provider.send('eth_getBalance',[account,'latest']);
    if (BigInt(eth) < parseEther('0.01')) await (await signer.sendTransaction({to:account,value:parseEther('0.02')})).wait();
    const balance = await token.balanceOf(account);
    if (balance < cap) await (await token.transfer(account,cap-balance)).wait();
  } finally { funding = false; }
}
const files = new Map([['/', ['text/html','./wallet.html']],['/wallet.mjs',['text/javascript','./wallet.mjs']],['/ethers.mjs',['text/javascript',ethersFile]],['/website.css',['text/css','../../../public/website.css']],['/styles.css',['text/css','../../../public/styles.css']]]);
http.createServer(async (req,res) => {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'");
  try {
    if (req.headers.host !== host || (req.headers.origin && req.headers.origin !== 'http://'+host)) {res.writeHead(403).end();return;}
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
