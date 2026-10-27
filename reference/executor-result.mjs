import {parseBoundedJson} from '../public/bounded-json.mjs';

const fail=()=>{throw new Error('EXECUTOR_RESULT_REJECTED');};
function keys(value,names){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==names.length||names.some(k=>!Object.hasOwn(value,k)))fail();
}
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const provenance=['engineLockSha256','adapterSourceSha256','outcomeSourceSha256','bindingSourceSha256'];
// Completion and expected identities come from the trusted caller, never from the file.
export function inspectExecutorResult(text,completion,expected){
 keys(completion,['exitCode','signal']);if(completion.exitCode!==0||completion.signal!==null)fail();
 keys(expected,['inputSha256','sourceManifestSha256','executorManifestSha256','sourceFiles','executorFiles',...provenance]);
 for(const k of ['inputSha256','sourceManifestSha256','executorManifestSha256',...provenance])if(!digest(expected[k]))fail();
 for(const k of ['sourceFiles','executorFiles'])if(!Number.isSafeInteger(expected[k])||expected[k]<1||expected[k]>256)fail();
 const file=parseBoundedJson(text,16384);keys(file,['schema','inputSha256','result']);
 if(file.schema!=='caw-selected-executor-file/1'||file.inputSha256!==expected.inputSha256)fail();
 const r=file.result;
 const completed=['execution-completed','execution-reverted'].includes(r?.kind);
 const kinds=['execution-completed','execution-reverted','missing-evidence','local-resource-limit','unsupported-operation','unclassified-failure'];
 keys(r,['schema','kind','stateComparisonVerified','stateRootRecomputed','publicChainAuthenticated','productionAccepted','provenance','sourceManifest','executorSelection',...(completed?['gasUsed']:[])]);
 if(r.schema!=='caw-replay-outcome/1'||!kinds.includes(r.kind))fail();
 for(const k of ['stateComparisonVerified','stateRootRecomputed','publicChainAuthenticated','productionAccepted'])if(r[k]!==false)fail();
 if(completed&&(typeof r.gasUsed!=='string'||!/^(0|[1-9][0-9]{0,77})$/.test(r.gasUsed)||BigInt(r.gasUsed)>((1n<<256n)-1n)))fail();
 keys(r.provenance,['algorithm','inputSha256',...provenance,'installedEngineAttested']);
 if(r.provenance.algorithm!=='sha256'||r.provenance.inputSha256!==expected.inputSha256||r.provenance.installedEngineAttested!==false)fail();
 for(const k of provenance)if(r.provenance[k]!==expected[k])fail();
 for(const [value,identity,count] of [[r.sourceManifest,expected.sourceManifestSha256,expected.sourceFiles],[r.executorSelection,expected.executorManifestSha256,expected.executorFiles]]){
  keys(value,['manifestSha256','filesChecked','installedEngineAttested']);
  if(value.manifestSha256!==identity||value.filesChecked!==count||value.installedEngineAttested!==false)fail();
 }
 return Object.freeze({schema:'caw-executor-result-inspection/1',recordMatchesSelection:true,kind:r.kind,...(completed?{gasUsed:r.gasUsed}:{}),inputSha256:expected.inputSha256,executionAuthenticated:false,stateRootRecomputed:false,productionAccepted:false});
}
