import {createHash} from 'node:crypto';
import {parseBoundedJson} from '../public/bounded-json.mjs';
import {inspectExecutorResult} from './executor-result.mjs';
// Caller supplies the owned process's captured stdout/exit and its own fresh request ID.
export function inspectOwnedExecutorOutput(text,stdout,completion,requestId,expected){
 if(typeof text!=='string'||Buffer.byteLength(text)>16384||typeof stdout!=='string'||Buffer.byteLength(stdout)>65536||typeof requestId!=='string'||!/^[a-f0-9]{32}$/.test(requestId))throw new Error('EXECUTOR_OUTPUT_LIMIT');
 const rows=stdout.trim().split(/\r?\n/).map(line=>parseBoundedJson(line,16384));
 const markers=rows.filter(x=>x?.schema==='caw-executor-output/1');
 if(markers.length!==1||rows.at(-1)!==markers[0])throw new Error('EXECUTOR_OUTPUT_MARKER');
 const marker=markers[0];
 if(Object.keys(marker).sort().join(',')!=='requestId,resultSha256,schema'||marker.requestId!==requestId||marker.resultSha256!==createHash('sha256').update(text).digest('hex'))throw new Error('EXECUTOR_OUTPUT_IDENTITY');
 return inspectExecutorResult(text,completion,expected);
}
