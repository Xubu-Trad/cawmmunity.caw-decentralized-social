import {Account,bytesToHex} from '@ethereumjs/util';
import {loadWitnessAdapter} from './witness-adapter.mjs';
// Opt-in London fixture bridge. Only reversible empty-native-account touches.
const NATIVE='0x'+'00'.repeat(19)+'01';
export async function loadNativeAbsenceAdapter(root){
 const baseFactory=await loadWitnessAdapter(root);
 const {inspectHeaderBoundStateProof}=await import(new URL('reference/header-bound-state-proof.mjs',root));
 const {parseBoundedJson}=await import(new URL('public/bounded-json.mjs',root));
 return function create(input,absenceText){
  if(arguments.length!==2||typeof absenceText!=='string')throw new TypeError('Two inputs required');
  const selected=parseBoundedJson(JSON.stringify(input),1048576),a=selected.anchor;
  if(a.selection.profile!=='london-16'||a.selection.chainId!=='0x7a69')throw new Error('NATIVE_ABSENCE_PROFILE');
  const proof=inspectHeaderBoundStateProof(absenceText,JSON.stringify({schema:'caw-header-state-selection/1',profile:'london-16',hash:a.selection.parentHash,address:NATIVE,storageKeys:[]}));
  if(proof.proof.accountExists)throw new Error('NATIVE_ABSENCE_REQUIRED');
  if(selected.dependencies.selection.dependencies.some(d=>d.address===NATIVE))throw new Error('NATIVE_ABSENCE_DUPLICATE');
  const base=baseFactory(selected);let failed=false,calls=0,firstFailure=null,present=false;const frames=[];
  function fail(code){firstFailure??=code;failed=true;const e=new Error(code);e.code=code;throw e;}
  function healthy(){if(failed)fail('NATIVE_ABSENCE_FAILED');base.healthy();}
  function address(args){const a=args[0];if(!a||!(a.bytes instanceof Uint8Array)||a.bytes.length!==20||a.toString()!==bytesToHex(a.bytes))fail('NATIVE_ABSENCE_ADDRESS');return bytesToHex(a.bytes);}
  const manager={};
  for(const [name,method] of Object.entries(base.stateManager)){
   if(typeof method!=='function')continue;
   manager[name]=async(...args)=>{try{
    if(name==='revert'){const result=await method(...args);present=frames.pop();return result;}
    healthy();if(++calls>4096)fail('NATIVE_ABSENCE_LIMIT');
    if(name==='checkpoint'){const result=await method(...args);frames.push(present);return result;}
    if(name==='commit'){const result=await method(...args);frames.pop();return result;}
    if(['getAccount','getCode','getStorage','putAccount','putCode','putStorage','deleteAccount','clearStorage'].includes(name)&&address(args)===NATIVE){
     if(name==='getAccount'||name==='getCode'){
      if(args.length!==1)fail('NATIVE_ABSENCE_ARGUMENTS');
      return name==='getAccount'?(present?new Account():undefined):new Uint8Array();
     }
     if(name==='putAccount'){
      const value=args[1],empty=new Account();
      if(args.length!==2||!(value instanceof Account)||value.nonce!==0n||value.balance!==0n||value.version!==0||value.codeSize!==0||bytesToHex(value.codeHash)!==bytesToHex(empty.codeHash)||bytesToHex(value.storageRoot)!==bytesToHex(empty.storageRoot))fail('NATIVE_ABSENCE_NONEMPTY_WRITE');
      present=true;return;
     }
     if(name==='deleteAccount'){if(args.length!==1)fail('NATIVE_ABSENCE_ARGUMENTS');present=false;return;}
     firstFailure??=name;fail('NATIVE_ABSENCE_WRITE_OR_STORAGE_UNSUPPORTED');
    }
    return await method(...args);
   }catch(error){failed=true;throw error;}};
  }
  manager.originalStorageCache=Object.freeze({get:async(...args)=>{try{healthy();if(++calls>4096)fail('NATIVE_ABSENCE_LIMIT');if(address(args)===NATIVE)fail('NATIVE_ABSENCE_STORAGE_UNSUPPORTED');return await base.stateManager.originalStorageCache.get(...args);}catch(error){failed=true;throw error;}},clear:()=>{}});
  const overlay=Object.freeze(Object.fromEntries(Object.entries(base.overlay).map(([name,method])=>[name,(...args)=>{if(name!=='discard')healthy();return method(...args);}])));
  return Object.freeze({...base,overlay,stateManager:Object.freeze(manager),healthy,provenAbsentNativeAccount:NATIVE,get firstFailure(){return firstFailure;}});
 };
}
