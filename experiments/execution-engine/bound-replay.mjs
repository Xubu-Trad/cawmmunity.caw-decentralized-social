import {createHash} from 'node:crypto';
import {readFileSync,statSync} from 'node:fs';
import {loadWitnessAdapter} from './witness-adapter.mjs';
import {runWitnessAttempt} from './replay-outcome.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function source(name,max){
  const path=new URL(name,import.meta.url);
  if(statSync(path).size>max)throw new Error('PROVENANCE_FILE_LIMIT');
  const bytes=readFileSync(path);
  if(bytes.length>max)throw new Error('PROVENANCE_FILE_LIMIT');
  return hash(bytes);
}
// Local source identity, not attestation of installed packages or a remote execution proof.
export async function runBoundWitnessAttempt(root,inputText,execute){
  if(typeof inputText!=='string'||Buffer.byteLength(inputText,'utf8')>1048576)throw new Error('PROVENANCE_INPUT_LIMIT');
  if(typeof execute!=='function')throw new TypeError('EXECUTOR_REQUIRED');
  const create=await loadWitnessAdapter(root);
  const adapter=create(JSON.parse(inputText));
  try{
    const provenance=Object.freeze({algorithm:'sha256',inputSha256:hash(Buffer.from(inputText,'utf8')),
      engineLockSha256:source('pnpm-lock.yaml',131072),adapterSourceSha256:source('witness-adapter.mjs',131072),
      outcomeSourceSha256:source('replay-outcome.mjs',131072),bindingSourceSha256:source('bound-replay.mjs',131072),
      installedEngineAttested:false});
    const outcome=await runWitnessAttempt(adapter,()=>execute(adapter));
    return Object.freeze({...outcome,provenance});
  }finally{adapter.overlay.discard();}
}
