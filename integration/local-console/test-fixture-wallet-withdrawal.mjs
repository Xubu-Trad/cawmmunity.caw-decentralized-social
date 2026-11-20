import assert from 'node:assert/strict';
import fs from 'node:fs';
import { keccak256 } from 'ethers';
import solc from 'solc';
import { verifyWithdrawalProofPackage } from './withdrawal-proof-package.mjs';

const dir=new URL('../../evidence/contract-wallet-withdrawal-20261119/',import.meta.url);
const read=name=>JSON.parse(fs.readFileSync(new URL(name,dir)));
const bundle=read('wallet-proofs.json'), pins=read('wallet-selection.json');
const checked=verifyWithdrawalProofPackage(bundle,pins);
assert.equal(checked.recipient,pins.config.contracts.wallet.address);
assert.equal(checked.controller,pins.config.controller);
assert.notEqual(checked.controller,checked.recipient);
assert.equal(checked.amount,'2');
assert(checked.controllerVerified && checked.recipientBalanceVerified);

// Rebuild the wallet and use the compiler's immutable locations. This checks
// what the fixed wallet runtime hash in the verifier actually commits to.
assert.equal(solc.version(),'0.8.30+commit.73712a01.Emscripten.clang');
const content=fs.readFileSync(new URL('../core-baseline-v1/WalletOwnerWithdrawalResearch.sol',import.meta.url),'utf8').replaceAll('\r\n','\n');
const sourceName='FundedAdmissionResearch.sol';
const compiled=JSON.parse(solc.compile(JSON.stringify({language:'Solidity',sources:{[sourceName]:{content}},
  settings:{optimizer:{enabled:true,runs:200},evmVersion:'shanghai',
    outputSelection:{'*':{'AccountOwnerWalletResearch':['evm.deployedBytecode']}}}})));
const runtime=compiled.contracts[sourceName].AccountOwnerWalletResearch.evm.deployedBytecode;
const refs=Object.values(runtime.immutableReferences);
assert.equal(refs.length,1);
assert(refs[0].length>0);
function runtimeHash(controller){
  const code=Buffer.from(runtime.object,'hex');
  const word=Buffer.from(controller.slice(2).padStart(64,'0'),'hex');
  for(const {start,length} of refs[0]){
    assert.equal(length,32);
    word.copy(code,start);
  }
  return keccak256(code);
}
assert.equal(runtimeHash(checked.controller),pins.config.contracts.wallet.codeHash);
assert.notEqual(runtimeHash(checked.recipient),pins.config.contracts.wallet.codeHash);

for(const [label,change,reason] of [
  ['substituted controller',(b,s)=>{b.selection.config.controller=s.config.controller=s.config.contracts.wallet.address;},/IMMUTABLE_CONTROLLER/],
  ['substituted recipient',(b,s)=>{b.evidence.after.observed.owner=s.config.controller;},/AUTHORITY_OWNER/],
  ['unchanged wallet balance',b=>{b.evidence.after.observed.balances.wallet=b.evidence.before.observed.balances.wallet;},/ACCOUNTING_BALANCE/],
  ['missing recipient proof',b=>{b.evidence.after.proofs.token.storageProof=[];},/proof|storage/i],
  ['substituted runtime',(b,s)=>{b.selection.config.contracts.wallet.codeHash=s.config.contracts.wallet.codeHash=s.config.contracts.token.codeHash;},/AUTHORITY_CODE_HASH/],
  ['different amount',(b,s)=>{b.selection.amount=s.amount='1';},/WITHDRAWAL_CALLDATA/],
  ['recipient changed in receipt',(b,s)=>{b.evidence.receipts[0].logs[0].topics[2]='0x'+s.config.controller.slice(2).padStart(64,'0');},/receipt|bloom/i],
]){
  const b=structuredClone(bundle),s=structuredClone(pins);
  change(b,s);
  assert.throws(()=>verifyWithdrawalProofPackage(b,s),reason,label);
}
console.log('Verified wallet withdrawal, compiler immutable references and seven rejection controls.');
