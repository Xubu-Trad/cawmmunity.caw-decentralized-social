import {pathToFileURL} from 'node:url';
import {createLocalRpc} from '../local-rpc.mjs';
import {encodeHeader} from './single-post-proof.mjs';

export async function readFeedCheckpoint(rpc,height){
  if(typeof height!=='string' || !/^0x(?:0|[1-9a-f][0-9a-f]{0,2})$/.test(height))
    throw Error('Supply a canonical hex height between 0x0 and 0xfff.');
  if(await rpc('eth_chainId',[])!=='0x539')throw Error('Expected disposable chain 1337.');
  const atHeight=()=>rpc('eth_getBlockByNumber',[height,false]);
  const block=await atHeight();
  if(block?.number!==height)throw Error('Receiver lacks the requested height.');
  encodeHeader(block);
  const final=await atHeight();
  if(final?.number!==height || final.hash!==block.hash)throw Error('Receiver checkpoint changed.');
  return {height,hash:block.hash};
}

if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  const [endpoint,height]=process.argv.slice(2);
  console.log(JSON.stringify(await readFeedCheckpoint(createLocalRpc(endpoint),height)));
}
