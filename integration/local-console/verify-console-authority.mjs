import assert from 'node:assert/strict';
import {keccak256,AbiCoder} from 'ethers';
import {inspectHeaderBoundStateProof} from '../../reference/header-bound-state-proof.mjs';
const OWNER='0xabbb5caa7dda850e60932de0934eb1f9d0f59695050f761dc64e443e5030a569',EPOCH='0x91da3fd0782e51c6b3986e9e672fd566868e71f3dbc2d6c2cd6fbb3e361af2a7';
const NONCE=keccak256(AbiCoder.defaultAbiCoder().encode(['uint256','uint256'],[2,0]));
export const AUTHORITY_SLOTS={owner:OWNER,epoch:EPOCH,nonce:NONCE};
export function verifyConsoleAuthority(header,proofs,config,observed){
 const verify=(name,address,keys,codeHash)=>{const r=inspectHeaderBoundStateProof(JSON.stringify({header,proof:proofs[name]}),JSON.stringify({schema:'caw-header-state-selection/1',profile:'shanghai-17',hash:header.hash,address,storageKeys:keys})).proof;assert.equal(r.codeHash,codeHash,'AUTHORITY_CODE_HASH');return r;};
 const value=(p,k)=>{const v=p.storage.find(x=>x.key===k);assert(v,'AUTHORITY_SLOT');return BigInt(v.value);};
 const registry=verify('registry',config.contracts.registry.address,[OWNER,EPOCH],config.contracts.registry.codeHash);
 const posting=verify('posting',config.contracts.posting.address,[NONCE],config.contracts.posting.codeHash);
 const n=value(registry,OWNER);assert(n>0xffffn&&n<2n**160n,'AUTHORITY_OWNER_RANGE');const owner='0x'+n.toString(16).padStart(40,'0');
 const wallet=owner===config.contracts.wallet.address;
 verify('owner',owner,[],wallet?config.contracts.wallet.codeHash:keccak256('0x'));
 assert.equal(observed.owner,owner,'AUTHORITY_OWNER');assert.equal(BigInt(observed.epoch),value(registry,EPOCH),'AUTHORITY_EPOCH');assert.equal(BigInt(observed.nonce),value(posting,NONCE),'AUTHORITY_NONCE');
 return {authorityProofsVerified:true,authorityHeaderHash:header.hash};
}
