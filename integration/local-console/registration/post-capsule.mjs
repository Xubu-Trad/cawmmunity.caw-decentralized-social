import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createLocalRpc} from '../local-rpc.mjs';
import {readJsonFile} from '../read-proof-file.mjs';
import {singletonEvidence} from './single-post-proof.mjs';
import {verifyPostCapsule} from './verify-post-capsule.mjs';

export async function capturePostCapsule(rpc,expectedBlockHash,expectedTxHash){
  if(![expectedBlockHash,expectedTxHash].every(value=>typeof value==='string' && /^0x[0-9a-f]{64}$/.test(value)))
    throw Error('Supply the expected lowercase post block hash and transaction hash.');
  if(await rpc('eth_chainId',[])!=='0x539')throw Error('Expected disposable chain 1337.');
  const block=await rpc('eth_getBlockByHash',[expectedBlockHash,false]);
  if(block?.hash!==expectedBlockHash)throw Error('Expected post block unavailable.');
  const capsule=await singletonEvidence(rpc,block,expectedTxHash);
  verifyPostCapsule(capsule,expectedBlockHash,expectedTxHash);
  const canonical=await rpc('eth_getBlockByNumber',[block.number,false]);
  if(canonical?.hash!==expectedBlockHash || canonical.number!==block.number)throw Error('Post block is no longer canonical.');
  return capsule;
}

if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  const [command,...args]=process.argv.slice(2);
  if(command==='capture' && args.length===4){
    const [endpoint,block,tx,file]=args;
    const capsule=await capturePostCapsule(createLocalRpc(endpoint),block,tx);
    await writeFile(file,JSON.stringify(capsule)+'\n',{flag:'wx'});
    console.log('Saved verified post evidence to '+file);
  }else if(command==='verify' && args.length===3){
    const [block,tx,file]=args;
    console.log(JSON.stringify(verifyPostCapsule(readJsonFile(file,131072),block,tx),null,2));
  }else{
    throw Error('Use capture RPC BLOCK_HASH TX_HASH NEW_FILE or verify BLOCK_HASH TX_HASH FILE.');
  }
}
