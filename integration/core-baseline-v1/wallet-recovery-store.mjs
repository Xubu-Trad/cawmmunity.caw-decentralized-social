import fs from 'node:fs/promises';import path from 'node:path';import {randomUUID} from 'node:crypto';import {inspectWalletRecovery} from './wallet-recovery-reader.mjs';
const MAX=524288;
// Single-writer local research store. Caller owns directory and trusted selection.
export async function recoverWalletFromChunks(chunks,selection,directory,checkpoint=async()=>{}){
 const stage=path.join(directory,'.wallet-stage-'+randomUUID());const target=path.join(directory,'wallet.json');let handle;
 try{
  handle=await fs.open(stage,'wx',0o600);let size=0;
  for await(const chunk of chunks){if(!(chunk instanceof Uint8Array))throw Error('CHUNK_TYPE');size+=chunk.byteLength;if(size>MAX)throw Error('DELIVERY_LIMIT');await handle.writeFile(chunk);await checkpoint('chunk');}
  await handle.sync();await handle.close();handle=null;await checkpoint('staged');
  const data=await fs.readFile(stage,'utf8');const result=inspectWalletRecovery(data,selection);await checkpoint('verified');
  await fs.rename(stage,target);await checkpoint('renamed');
  const dir=await fs.open(directory,'r');try{await dir.sync();}finally{await dir.close();}await checkpoint('directory-synced');return result;
 }finally{if(handle)await handle.close();await fs.rm(stage,{force:true});}
}
export async function readRecoveredWallet(directory,selection){
 const file=path.join(directory,'wallet.json');const stat=await fs.stat(file);if(stat.size>MAX)throw Error('DELIVERY_LIMIT');return inspectWalletRecovery(await fs.readFile(file,'utf8'),selection);
}
