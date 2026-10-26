import {openSync,readSync,closeSync,fstatSync,existsSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

// One request per invocation. Use an external supervisor for resource/runtime policy.
try {
  if(process.argv.length!==7)throw new Error('ARGUMENTS');
  const [root,inputPath,sourceDigest,executorDigest,outputPath]=process.argv.slice(2);
  if(existsSync(outputPath))throw new Error('OUTPUT_EXISTS');
  const fd=openSync(inputPath,'r');let bytes;
  try {
    const stat=fstatSync(fd);
    if(!stat.isFile()||stat.size>1048576)throw new Error('INPUT_LIMIT');
    const buffer=Buffer.alloc(1048577);let used=0;
    while(used<buffer.length){const n=readSync(fd,buffer,used,buffer.length-used,null);if(n===0)break;used+=n;}
    if(used>1048576||used!==stat.size)throw new Error('INPUT_LIMIT');
    bytes=buffer.subarray(0,used);
  }finally{closeSync(fd);}
  const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);
  const {runSelectedExecutor}=await import('./selected-executor-gate.mjs');
  const result=await runSelectedExecutor(pathToFileURL(resolve(root)+'/'),text,sourceDigest,executorDigest);
  const inputSha256=createHash('sha256').update(bytes).digest('hex');
  if(result.provenance.inputSha256!==inputSha256)throw new Error('INPUT_IDENTITY');
  // Exclusive create prevents overwriting a retained record, including on an output race.
  writeFileSync(outputPath,JSON.stringify({schema:'caw-selected-executor-file/1',inputSha256,result})+'\n',{encoding:'utf8',flag:'wx',mode:0o600});
}catch {
  console.error('SELECTED_EXECUTOR_PROCESS_FAILED');
  process.exitCode=1;
}
