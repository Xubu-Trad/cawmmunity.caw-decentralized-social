import {inspectHeaderBoundCode} from '../../reference/header-bound-state-proof.mjs';
import {parseBoundedJson} from '../../public/bounded-json.mjs';
import {inventory} from './inventory.mjs';

// Chain ID is a caller label: execution headers alone do not authenticate it.
export function boundInventory(evidenceText, selectionText) {
  const s=parseBoundedJson(selectionText,16384);
  const keys=['chainId','blockNumber','blockHash','address','codeHash','profile'];
  if(!s || Object.keys(s).length!==keys.length || !keys.every(k=>Object.hasOwn(s,k))) throw Error('ASSET_SELECTION');
  const e=parseBoundedJson(evidenceText,524288);
  // Never discard supplied storage proofs: this is an explicitly account-only lane.
  if(!Array.isArray(e?.proof?.storageProof)||e.proof.storageProof.length!==0) throw Error('ASSET_ACCOUNT_ONLY');
  const proof=inspectHeaderBoundCode(evidenceText,JSON.stringify({schema:'caw-header-code-selection/1',profile:s.profile,hash:s.blockHash,address:s.address,storageKeys:[],expectedCodeHash:s.codeHash}));
  const expected=Object.fromEntries(keys.filter(k=>k!=='profile').map(k=>[k,s[k]]));
  const scan=inventory({...expected,blockNumber:BigInt(e.header.number).toString(),codeHash:proof.codeHash,code:e.code},expected);
  return {schema:'caw-header-bound-asset-inventory/1',inventory:scan,accountProofAgainstSelectedHeaderVerified:proof.codeMatchesSelectedState,selectedStateRoot:proof.state.header.stateRoot,
    storageVerified:false,chainIdAuthenticated:false,consensusVerified:false,finalityVerified:false,currentStateVerified:false,sourceMatchVerified:false,upgradeAuthorityVerified:false,productionAccepted:false};
}
