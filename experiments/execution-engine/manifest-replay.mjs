import {verifyLocalManifest} from './source-manifest.mjs';
export async function runManifestReplay(root,inputText,expectedManifestSha256,execute){
 const source=verifyLocalManifest(root,expectedManifestSha256);
 const {runBoundWitnessAttempt}=await import('./bound-replay.mjs');
 const report=await runBoundWitnessAttempt(root,inputText,execute);
 return Object.freeze({...report,sourceManifest:source});
}
