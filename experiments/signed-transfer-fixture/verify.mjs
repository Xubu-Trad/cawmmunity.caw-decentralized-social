import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {inspectReplayInputBinding} from '../../reference/replay-input-binding.mjs';
import {inspectReplayDependencies} from '../../reference/replay-dependencies.mjs';
import {inspectBlockReceipts} from '../../reference/ethereum-block-receipts.mjs';
const f=JSON.parse(readFileSync(new URL('fixture.json',import.meta.url)));
function deps(state){return {schema:'caw-replay-dependencies/1',header:state.header,selection:{profile:'london-16',parentHash:state.header.hash,dependencies:state.witnesses.map(w=>({address:w.proof.address,storageKeys:[],expectedCodeHash:w.proof.codeHash}))},witnesses:state.witnesses};}
const input={schema:'caw-replay-input-binding/1',anchor:{schema:'caw-first-transaction-anchor/1',parentHeader:f.parent.header,header:f.child.header,rawTransactions:[f.rawTransaction],selection:{profile:'london-16',parentHash:f.parent.header.hash,blockHash:f.child.header.hash,chainId:'0x7a69',transactionIndex:'0x0',transactionHash:f.transactionHash}},dependencies:deps(f.parent)};
const parent=inspectReplayInputBinding(JSON.stringify(input)),child=inspectReplayDependencies(JSON.stringify(deps(f.child)));
inspectBlockReceipts(f.child.header,[f.receipt],{schema:'caw-block-receipts-selection/1',profile:'london-16',hash:f.child.header.hash});
assert.equal(parent.anchor.transaction.from,f.accounts[0]);
const before=parent.dependencies.dependencies.map(x=>x.state.proof),after=child.dependencies.map(x=>x.state.proof);
const gas=BigInt(f.receipt.gasUsed),price=100000000000n,base=BigInt(f.child.header.baseFeePerGas);
assert.equal(gas,21000n);assert.equal(f.receipt.status,'0x1');
assert.equal(BigInt(after[0].nonce),BigInt(before[0].nonce)+1n);
assert.equal(BigInt(after[0].balance),BigInt(before[0].balance)-1n-gas*price);
assert.equal(BigInt(after[1].balance),BigInt(before[1].balance)+1n);
assert.equal(BigInt(after[2].balance),BigInt(before[2].balance)+gas*(price-base));
for(let i=0;i<3;i++){assert.equal(before[i].codeHash,after[i].codeHash);assert.equal(f.parent.witnesses[i].code,'0x');}
const swapped=structuredClone(input);swapped.dependencies=deps(f.child);assert.throws(()=>inspectReplayInputBinding(JSON.stringify(swapped)));
const changed=structuredClone(input);changed.anchor.rawTransactions=[f.rawTransaction.slice(0,-2)+'00'];assert.throws(()=>inspectReplayInputBinding(JSON.stringify(changed)));
console.log(JSON.stringify({checks:3,passed:3,scope:'signed body, sender, parent and child proofs, receipt root, expected transfer and fee deltas; swapped state and changed body rejected',localObservedTransfer:true,independentReplay:false,publicChainAuthenticated:false,productionAccepted:false}));
