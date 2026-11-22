import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import solc from 'solc';
import {Interface} from 'ethers';
import {recommendedUsernameBurn} from '../../public/economics.mjs';
import {createLocalRpc} from './local-rpc.mjs';

const rpc = createLocalRpc(process.argv[2]);
assert.equal(await rpc('eth_chainId',[]),'0x539','disposable Geth dev chain required');
const file='UsernameTerms.sol';
const source=await readFile(new URL('./'+file,import.meta.url),'utf8');
const compiled=JSON.parse(solc.compile(JSON.stringify({language:'Solidity',sources:{[file]:{content:source}},
  settings:{evmVersion:'shanghai',outputSelection:{'*':{'*':['abi','evm.bytecode.object']}}}})));
const contract=compiled.contracts[file].UsernameTerms;
const abi=new Interface(contract.abi);
const [from]=await rpc('eth_accounts',[]);
const hash=await rpc('eth_sendTransaction',[{from,data:'0x'+contract.evm.bytecode.object,gas:'0x1e8480'}]);
let receipt;
for(let i=0;i<50 && !receipt;i++){
  receipt=await rpc('eth_getTransactionReceipt',[hash]);
  if(!receipt) await new Promise(resolve=>setTimeout(resolve,100));
}
assert.equal(receipt?.status,'0x1');
const quote=name=>rpc('eth_call',[{to:receipt.contractAddress,data:abi.encodeFunctionData('quote',[name])},receipt.blockNumber]);
const costs=[1000000000000n,240000000000n,60000000000n,6000000000n,200000000n,20000000n,10000000n,1000000n];
for(const [i,cost] of costs.entries()){
  const name='a'.repeat(i)+'9';
  assert.equal(BigInt(await quote(name)),cost*10n**18n);
  assert.equal(recommendedUsernameBurn(name),cost*10n**18n);
}
assert.equal(BigInt(await quote('a'.repeat(40))),recommendedUsernameBurn('a'.repeat(40)));
for(const name of ['', 'CAW','a-b','🐦','caw\n']){
  assert.equal(recommendedUsernameBurn(name),null);
  await assert.rejects(quote(name));
}
console.log('Disposable dev chain: deployed username terms, verified all eight recommended tiers, a 40-character name and five invalid names.');
