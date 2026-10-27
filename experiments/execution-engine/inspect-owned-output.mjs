import {readFileSync,statSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
try {
 if(process.argv.length!==5)throw new Error('ARGUMENTS');
 const [root,packetPath,out]=process.argv.slice(2);
 if(statSync(packetPath).size>131072)throw new Error('PACKET_LIMIT');
 const raw=readFileSync(packetPath,'utf8');if(Buffer.byteLength(raw)>131072)throw new Error('PACKET_LIMIT');
 const {parseBoundedJson}=await import(new URL('public/bounded-json.mjs',pathToFileURL(resolve(root)+'/')));
 const p=parseBoundedJson(raw,131072);
 const {inspectOwnedExecutorOutput}=await import(new URL('reference/executor-output.mjs',pathToFileURL(resolve(root)+'/')));
 const result=inspectOwnedExecutorOutput(p.text,p.stdout,p.completion,p.requestId,p.expected);
 writeFileSync(out,JSON.stringify(result)+'\n',{flag:'wx'});
}catch {console.error('OWNED_EXECUTOR_OUTPUT_REJECTED');process.exitCode=1;}
