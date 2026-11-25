import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {keccak256} from 'ethers';
import {createLocalRpc} from '../local-rpc.mjs';

const manifest=JSON.parse(readFileSync(new URL('./disposable-runtime.json',import.meta.url),'utf8'));

export async function verifyRuntime(rpc,checkpoint){
  if(!/^0x[0-9a-f]{64}$/.test(checkpoint))throw Error('Supply the checkpoint block hash.');
  if(await rpc('eth_chainId',[])!==manifest.chainId)throw Error('Expected disposable chain 1337.');
  const block=await rpc('eth_getBlockByHash',[checkpoint,false]);
  if(block?.hash!==checkpoint || !/^0x(?:0|[1-9a-f][0-9a-f]*)$/.test(block.number))
    throw Error('Checkpoint unavailable.');
  const contracts=[];
  for(const [role,{address,runtimeKeccak256}] of Object.entries(manifest.contracts)){
    const code=await rpc('eth_getCode',[address,{blockHash:checkpoint,requireCanonical:true}]);
    if(code==='0x'||keccak256(code)!==runtimeKeccak256)throw Error('Runtime mismatch: '+role+' at '+address);
    contracts.push(role);
  }
  const canonical=await rpc('eth_getBlockByNumber',[block.number,false]);
  if(canonical?.hash!==checkpoint || canonical.number!==block.number)throw Error('Checkpoint changed.');
  return {block:block.number,checkpoint,contracts};
}

if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  const [endpoint,checkpoint]=process.argv.slice(2);
  console.log(JSON.stringify(await verifyRuntime(createLocalRpc(endpoint),checkpoint),null,2));
}
