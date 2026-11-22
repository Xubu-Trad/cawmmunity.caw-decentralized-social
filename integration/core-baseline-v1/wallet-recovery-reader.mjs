import {parseBoundedJson} from '../../public/bounded-json.mjs';
import {inspectHeaderBoundCode,inspectHeaderBoundStateProof} from '../../reference/header-bound-state-proof.mjs';
function need(ok,code){if(!ok)throw Object.assign(new Error(code),{code});}
// Selection is retained locally by the reader. Never take it from the donor bundle.
export function inspectWalletRecovery(bundleText,selectionText){
 const bundle=parseBoundedJson(bundleText,524288),selected=parseBoundedJson(selectionText,65536);
 need(bundle.schema==='caw-wallet-recovery/1','BUNDLE_SCHEMA');
 need(Object.keys(bundle).sort().join(',')==='accounts,schema','BUNDLE_FIELDS');
 need(selected.schema==='caw-wallet-recovery-selection/1','SELECTION_SCHEMA');
 need(Array.isArray(selected.accounts)&&selected.accounts.length===4,'SELECTION_ACCOUNTS');
 need(Array.isArray(bundle.accounts)&&bundle.accounts.length===4,'BUNDLE_ACCOUNTS');
 need(new Set(selected.accounts.map(x=>x.address)).size===4,'DUPLICATE_SELECTION');
 const result=[];
 for(let i=0;i<4;i++){
  const s=selected.accounts[i],e=bundle.accounts[i];
  const base={profile:'shanghai-17',hash:selected.headerHash,address:s.address,storageKeys:s.fields.map(f=>f.key)};
  const r=s.expectedCodeHash?inspectHeaderBoundCode(JSON.stringify(e),JSON.stringify({...base,schema:'caw-header-code-selection/1',expectedCodeHash:s.expectedCodeHash})).state:inspectHeaderBoundStateProof(JSON.stringify(e),JSON.stringify({...base,schema:'caw-header-state-selection/1'}));
  for(const f of s.fields){const v=r.proof.storage.find(x=>x.key===f.key);need(v&&BigInt(v.value)===BigInt(f.expected),'EXPECTED_STORAGE');}
  result.push({address:s.address,fields:s.fields.length,stateRoot:r.header.stateRoot});
 }
 need(new Set(result.map(x=>x.stateRoot)).size===1,'MIXED_ROOTS');
 return Object.freeze({schema:'caw-wallet-recovery-result/1',headerHash:selected.headerHash,stateRoot:result[0].stateRoot,accounts:4,fields:result.reduce((n,x)=>n+x.fields,0),chainAuthenticated:false,finalityVerified:false});
}
// A failed candidate leaves the previous verified view unchanged.
export function createWalletRecoveryReader(selectionText){
 need(typeof selectionText==='string','SELECTION_TEXT');let accepted=null;
 return Object.freeze({accept(bundleText){const next=inspectWalletRecovery(bundleText,selectionText);accepted=next;return next;},current(){return accepted;}});
}

