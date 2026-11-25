import {writeFile} from 'node:fs/promises';
import {createLocalRpc} from '../local-rpc.mjs';
import {readJsonFile} from '../read-proof-file.mjs';
import {capturePostCheckpoint,verifyPostCheckpoint} from './post-checkpoint.mjs';

const [command,...args]=process.argv.slice(2);
if(command==='capture' && args.length===6){
  const [endpoint,block,tx,archive,checkpoint,file]=args;
  const post=readJsonFile(archive,524288);
  const evidence=await capturePostCheckpoint(createLocalRpc(endpoint),post,block,tx,checkpoint);
  const result=verifyPostCheckpoint(post,block,tx,checkpoint,evidence);
  await writeFile(file,JSON.stringify(evidence)+'\n',{flag:'wx'});
  console.log(JSON.stringify(result,null,2));
}else if(command==='verify' && args.length===5){
  const [block,tx,archive,checkpoint,file]=args;
  const result=verifyPostCheckpoint(readJsonFile(archive,524288),block,tx,checkpoint,readJsonFile(file,524288));
  console.log(JSON.stringify(result,null,2));
}else{
  throw Error('Use capture RPC POST_BLOCK TX_HASH POST_FILE CHECKPOINT NEW_FILE or verify POST_BLOCK TX_HASH POST_FILE CHECKPOINT HEADER_FILE.');
}
