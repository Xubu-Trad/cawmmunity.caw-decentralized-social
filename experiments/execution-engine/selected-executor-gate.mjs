import {readFileSync,statSync,realpathSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {checkManifest,verifyLocalManifest} from './source-manifest.mjs';

const paths=['selected-london-executor.mjs','esm-package-entry.mjs'];
export function checkExecutorSelection(text,expected,read) {
  // Identity/size are checked before parsing and reading declared source entries.
  const checked=checkManifest(text,expected,read);
  const m=JSON.parse(text);
  if(m.files.length!==2||!paths.every(p=>m.files.some(e=>e.root==='engine'&&e.path===p)))
    throw new Error('EXECUTOR_SELECTION_FILES');
  return checked;
}

export async function runSelectedExecutor(root,inputText,expectedManifest,expectedExecutor) {
  if(arguments.length!==4)throw new Error('EXECUTOR_ARGUMENTS');
  if(typeof inputText!=='string'||Buffer.byteLength(inputText)>1048576)throw new Error('PROVENANCE_INPUT_LIMIT');
  const source=verifyLocalManifest(root,expectedManifest);
  const selectionURL=new URL('executor-selection.json',import.meta.url);
  if(statSync(selectionURL).size>131072)throw new Error('MANIFEST_IDENTITY');
  const selection=checkExecutorSelection(readFileSync(selectionURL,'utf8'),expectedExecutor,e=>{
    if(e.root!=='engine'||!paths.includes(e.path))throw new Error('EXECUTOR_SELECTION_FILES');
    const url=new URL(e.path,import.meta.url),p=fileURLToPath(url);
    if(realpathSync(p)!==p||statSync(p).size!==e.size)throw new Error('MANIFEST_SOURCE_MISMATCH');
    return readFileSync(url);
  });
  const input=JSON.parse(inputText);
  const {executeSelectedLondon}=await import('./selected-london-executor.mjs');
  const {runBoundWitnessAttempt}=await import('./bound-replay.mjs');
  const outcome=await runBoundWitnessAttempt(root,inputText,adapter=>executeSelectedLondon(adapter,input));
  return Object.freeze({...outcome,sourceManifest:source,executorSelection:selection});
}
