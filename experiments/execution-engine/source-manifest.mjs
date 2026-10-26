import {createHash} from 'node:crypto';
import {readFileSync,realpathSync,statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,sep} from 'node:path';
const sha=b=>createHash('sha256').update(b).digest('hex');
export function checkManifest(text,expectedHash,read){
 if(typeof text!=='string'||Buffer.byteLength(text)>131072||!/^[a-f0-9]{64}$/.test(expectedHash)||sha(text)!==expectedHash)throw new Error('MANIFEST_IDENTITY');
 const m=JSON.parse(text);
 if(m.schema!=='caw-local-source-manifest/1'||!Array.isArray(m.files)||m.files.length<1||m.files.length>256)throw new Error('MANIFEST_SCHEMA');
 const seen=new Set();let total=0;
 for(const entry of m.files){
  if(!entry||!['engine','repo'].includes(entry.root)||typeof entry.path!=='string'||!/^[-a-zA-Z0-9_./]+$/.test(entry.path)||entry.path.split('/').some(x=>!x||x==='.'||x==='..')||!/^[a-f0-9]{64}$/.test(entry.sha256)||!Number.isSafeInteger(entry.size)||entry.size<0||entry.size>1048576)throw new Error('MANIFEST_ENTRY');
  const id=entry.root+':'+entry.path;if(seen.has(id))throw new Error('MANIFEST_DUPLICATE');seen.add(id);
  total+=entry.size;if(total>8388608)throw new Error('MANIFEST_TOTAL');
  const bytes=read(entry);if(!(bytes instanceof Uint8Array)||bytes.length!==entry.size||sha(bytes)!==entry.sha256)throw new Error('MANIFEST_SOURCE_MISMATCH');
 }
 return Object.freeze({manifestSha256:expectedHash,filesChecked:m.files.length,installedEngineAttested:false});
}
export function verifyLocalManifest(root,expectedHash){
 const bases={repo:realpathSync(fileURLToPath(root)),engine:realpathSync(fileURLToPath(new URL('.',import.meta.url)))};
 const manifestPath=new URL('source-manifest.json',import.meta.url);
 if(statSync(manifestPath).size>131072)throw new Error('MANIFEST_IDENTITY');
 const text=readFileSync(manifestPath,'utf8');
 return checkManifest(text,expectedHash,e=>{
  const path=resolve(bases[e.root],e.path),real=realpathSync(path);
  if(real!==path||!real.startsWith(bases[e.root]+sep))throw new Error('MANIFEST_PATH');
  if(statSync(real).size!==e.size)throw new Error('MANIFEST_SOURCE_MISMATCH');
  return readFileSync(real);
 });
}
