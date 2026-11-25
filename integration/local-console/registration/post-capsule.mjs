import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createLocalRpc} from '../local-rpc.mjs';
import {readJsonFile} from '../read-proof-file.mjs';
import {encodeHeader,readBlockEntry,singletonEvidence} from './single-post-proof.mjs';
import {verifyPostCapsule} from './verify-post-capsule.mjs';

export async function capturePostCapsule(rpc,expectedBlockHash,expectedTxHash){
  if(![expectedBlockHash,expectedTxHash].every(value=>typeof value==='string' && /^0x[0-9a-f]{64}$/.test(value)))
    throw Error('Supply the expected lowercase post block hash and transaction hash.');
  if(await rpc('eth_chainId',[])!=='0x539')throw Error('Expected disposable chain 1337.');
  const block=await rpc('eth_getBlockByHash',[expectedBlockHash,false]);
  if(block?.hash!==expectedBlockHash)throw Error('Expected post block unavailable.');
  const hashes=block.transactions;
  if(!Array.isArray(hashes) || !hashes.length || hashes.length>32 || !hashes.includes(expectedTxHash))
    throw Error('Expected post in a block of 1 to 32 transactions.');
  if(new Set(hashes).size!==hashes.length)throw Error('Duplicate transaction hash in block.');
  let capsule;
  if(hashes.length===1){
    capsule=await singletonEvidence(rpc,block,expectedTxHash);
  }else{
    capsule={header:encodeHeader(block),transactions:[],receipts:[]};
    let size=JSON.stringify(capsule).length+1;
    for(let i=0;i<hashes.length;i++){
      const {txBytes,receipt}=await readBlockEntry(rpc,block,i);
      size+=txBytes.length+receipt.length+4+(i===0?0:2);
      if(size>524288)throw Error('Mixed-block archive exceeds 512 KiB.');
      capsule.transactions.push(txBytes);
      capsule.receipts.push(receipt);
    }
  }
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
    console.log(JSON.stringify(verifyPostCapsule(readJsonFile(file,524288),block,tx),null,2));
  }else{
    throw Error('Use capture RPC BLOCK_HASH TX_HASH NEW_FILE or verify BLOCK_HASH TX_HASH FILE.');
  }
}
