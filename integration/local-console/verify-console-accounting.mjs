import assert from 'node:assert/strict';
import {AbiCoder,keccak256} from 'ethers';
import {inspectHeaderBoundStateProof} from '../../reference/header-bound-state-proof.mjs';
const abi=AbiCoder.defaultAbiCoder(),slot=n=>'0x'+BigInt(n).toString(16).padStart(64,'0');
const credit=id=>keccak256(abi.encode(['uint256','uint256'],[id,6]));
const balance=a=>keccak256(abi.encode(['address','uint256'],[a,0]));
export function accountingSlots(config,owner){
 assert.match(owner,/^0x[0-9a-f]{40}$/);
 return {custody:[slot(1),slot(2),slot(7),credit(2),credit(3),credit(4)],token:[...new Set([config.contracts.wallet.address,owner,config.contracts.custody.address].map(balance))]};
}
// Storage layout belongs only to the selected WalletOwnerWithdrawalResearch fixture.
export function verifyConsoleAccounting(header,proofs,config,observed){
 const keys=accountingSlots(config,observed.owner);
 const check=name=>{const r=inspectHeaderBoundStateProof(JSON.stringify({header,proof:proofs[name]}),JSON.stringify({schema:'caw-header-state-selection/1',profile:'shanghai-17',hash:header.hash,address:config.contracts[name].address,storageKeys:keys[name]})).proof;assert.equal(r.codeHash,config.contracts[name].codeHash,'ACCOUNTING_CODE_HASH');return r;};
 const custody=check('custody'),token=check('token');
 const value=(p,k)=>{const f=p.storage.find(x=>x.key===k);assert(f,'ACCOUNTING_SLOT');return BigInt(f.value);};
 const unpaid=value(custody,slot(1)),unallocated=value(custody,slot(2)),credited=value(custody,slot(7));
 const credits=[2,3,4].map(id=>value(custody,credit(id)));
 assert.equal(BigInt(observed.credit),credits[0],'ACCOUNTING_CREDIT');assert.equal(BigInt(observed.unpaidLiability),unpaid,'ACCOUNTING_LIABILITY');
 for(const [label,address]of Object.entries({wallet:config.contracts.wallet.address,owner:observed.owner,custody:config.contracts.custody.address}))assert.equal(BigInt(observed.balances[label]),value(token,balance(address)),'ACCOUNTING_BALANCE_'+label);
 assert.equal(unpaid,unallocated+credited,'ACCOUNTING_TOTAL');assert.equal(credited,credits.reduce((a,b)=>a+b,0n),'ACCOUNTING_CREDIT_SUM');assert(value(token,balance(config.contracts.custody.address))>=unpaid,'ACCOUNTING_BACKING');
 return {accountingProofsVerified:true,accountingHeaderHash:header.hash,unpaidLiability:String(unpaid),unallocatedBudget:String(unallocated),creditedLiability:String(credited)};
}
