// Full signed transaction execution under selected local block contexts, not block consensus replay.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createVM,runTx} from '@ethereumjs/vm';
import {createTxFromRLP} from '@ethereumjs/tx';
import {createBlock} from '@ethereumjs/block';
import {MerkleStateManager,getMerkleStateProof} from '@ethereumjs/statemanager';
import {createCustomCommon,Mainnet,Hardfork} from '@ethereumjs/common';
import {Account,createAddressFromString} from '@ethereumjs/util';
import {inspectExecutionHeaderChain} from '../../reference/ethereum-execution-header.mjs';
import {inspectBlockSenders} from '../../reference/ethereum-block-senders.mjs';
import {inspectBlockTransactionReceipts} from '../../reference/ethereum-block-transactions.mjs';
import {inspectEthereumStateProof} from '../../reference/ethereum-state-proof.mjs';
import {keccak256Hex} from '../../reference/keccak256.mjs';
import {reconstruct} from './reconstruct-accounting.mjs';
const [directory,out]=process.argv.slice(2);assert(directory&&out&&!fs.existsSync(out));fs.mkdirSync(out);
const read=n=>{const p=directory+'/'+n;assert(fs.statSync(p).size<8*1024**2);return JSON.parse(fs.readFileSync(p));};
const capture=read('acquired-history.json'),contracts=Object.assign({},...Object.values(read('compiler-output.json').contracts));
assert.equal(capture.chainId,'0x7a69');const blocks=capture.blocks.slice(1);assert.equal(blocks.length,27);
inspectExecutionHeaderChain(blocks.map(b=>b.block),{schema:'caw-execution-header-chain-selection/1',profile:'shanghai-17',startHash:blocks[0].block.hash,endHash:blocks.at(-1).block.hash});
const history=[];
for(const b of blocks){const joined=inspectBlockTransactionReceipts(b.block,b.rawTransactions,b.receipts,{schema:'caw-block-transactions-selection/1',profile:'shanghai-17',hash:b.block.hash});const senders=inspectBlockSenders(b.block,b.rawTransactions,{schema:'caw-block-senders-selection/1',profile:'shanghai-17',hash:b.block.hash,chainId:'0x7a69',allowUnprotectedLegacy:false});assert.equal(senders.transactions.length,1);history.push({blockNumber:b.block.number,blockHash:b.block.hash,transaction:senders.transactions[0],receipt:joined.receipts[0],association:joined.associations[0]});}
const model=reconstruct(history,contracts,Object.fromEntries(blocks.map(b=>[b.block.hash,b.block.timestamp])));
const stateManager=new MerkleStateManager();const common=createCustomCommon({chainId:31337},Mainnet,{hardfork:Hardfork.Shanghai});const vm=await createVM({common,stateManager});
const genesis=read('genesis.json');const native={};for(const [a,entry]of Object.entries(genesis.alloc)){const address=a.startsWith('0x')?a:'0x'+a;native[address]=BigInt(entry.balance);await stateManager.putAccount(createAddressFromString(address),new Account(0n,native[address]));}
let burned=0n,totalGas=0n;
const bytes=h=>Uint8Array.from(Buffer.from(h.slice(2),'hex')),hex=b=>'0x'+Buffer.from(b).toString('hex'),W=n=>'0x'+BigInt(n).toString(16).padStart(64,'0');
const rows=[];
for(let i=0;i<history.length;i++){
 const row=history[i],t=row.transaction,h=blocks[i].block;assert.equal(t.type,'0x0');assert.equal(t.value,'0x0');
 const caller=createAddressFromString(t.from),account=await stateManager.getAccount(caller);assert.equal(account?.nonce??0n,BigInt(t.nonce),'CALLER_NONCE');
 const before=hex(await stateManager.getStateRoot());const data=bytes(t.data);
 const tx=createTxFromRLP(bytes(t.encoded),{common});assert(tx.verifySignature());assert.equal(tx.getSenderAddress().toString(),t.from);
 const block=createBlock({header:{number:BigInt(h.number),timestamp:BigInt(h.timestamp),gasLimit:BigInt(h.gasLimit),baseFeePerGas:BigInt(h.baseFeePerGas),coinbase:h.miner,difficulty:BigInt(h.difficulty),mixHash:h.mixHash}},{common});
 const result=await runTx(vm,{tx,block,blockGasUsed:0n});
 assert.equal(result.totalGasSpent,BigInt(row.receipt.cumulativeGasUsed),'CAPTURED_GAS');assert.equal(hex(result.bloom.bitvector),row.receipt.logsBloom,'RECEIPT_BLOOM');
 const charge=result.totalGasSpent*BigInt(t.gasPrice),burn=result.totalGasSpent*BigInt(h.baseFeePerGas);native[t.from]-=charge;native[h.miner]=(native[h.miner]??0n)+charge-burn;burned+=burn;totalGas+=result.totalGasSpent;
 for(const [address,balance]of Object.entries(native)){const a=await stateManager.getAccount(createAddressFromString(address));assert.equal(a?.balance??0n,balance,'NATIVE_ACCOUNTING');}
 const status=result.execResult.exceptionError?'0x0':'0x1';assert.equal(status,row.receipt.status,'EXECUTION_STATUS');
 const logs=(result.execResult.logs??[]).map(([a,t,d])=>({address:hex(a),topics:t.map(hex),data:hex(d)}));assert.deepEqual(logs,row.receipt.logs,'EXECUTION_LOGS');
 rows.push({hash:t.hash,blockNumber:row.blockNumber,status,createdAddress:result.createdAddress?.toString(),beforeRoot:before,afterRoot:hex(await stateManager.getStateRoot()),executionGasUsed:String(result.execResult.executionGasUsed),totalGasSpent:String(result.totalGasSpent),gasRefund:String(result.gasRefund),nativeCharge:String(charge),baseFeeBurn:String(burn)});
}
const root=hex(await stateManager.getStateRoot()),proofs=[],values={};
function layout(c,label){const x=c.storageLayout.storage.find(x=>x.label===label);assert(x);return x;}
const v=contracts.DeployedCustodyStakeResearch,m=contracts.MockTokenResearch;
const fields=Object.keys(model.final).filter(x=>!['nonce','balance'].includes(x)).map(label=>{const f=layout(v,label);return {label,key:W(f.slot),offset:f.offset,width:Number(v.storageLayout.types[f.type].numberOfBytes),expected:model.final[label]};});
const hashSlot=(key,slot)=>keccak256Hex(W(key)+W(slot).slice(2));fields.push({label:'nonce',key:hashSlot(1,layout(v,'postNonces').slot),offset:0,width:32,expected:model.final.nonce});
const wallets=Object.entries(model.wallets).map(([label,expected])=>({label,key:hashSlot(BigInt(label),layout(m,'balanceOf').slot),offset:0,width:32,expected}));
for(const [address,items]of [[model.vault,fields],[model.token,wallets]])for(let i=0;i<items.length;i+=16){
 const batch=items.slice(i,i+16),raw=await getMerkleStateProof(stateManager,createAddressFromString(address),batch.map(x=>bytes(x.key)));
 const proof={...raw,storageProof:raw.storageProof.map(x=>({...x,value:'0x'+BigInt(x.value).toString(16)}))};
 const checked=inspectEthereumStateProof(proof,{stateRoot:root,address,storageKeys:batch.map(x=>x.key)});
 for(const f of batch){const slot=checked.storage.find(x=>x.key===f.key);assert(slot);const n=(BigInt(slot.value)>>BigInt(8*f.offset))&((1n<<BigInt(8*f.width))-1n);assert.equal(String(n),f.expected,'MODEL_PROOF_VALUE');values[address+':'+f.label]={value:String(n),exists:slot.exists};}
 proofs.push({address,fields:batch,raw,proof});
}
assert.equal(Object.keys(values).length,21);assert.equal(values[model.vault+':epoch3'].exists,false);
const zeroWallet=Object.keys(model.wallets).find(a=>model.wallets[a]==='0');assert.equal(values[model.token+':'+zeroWallet].exists,false);
const negativeControls=[];
const sample=proofs[0];const selection={stateRoot:root,address:sample.address,storageKeys:sample.fields.map(x=>x.key)};
for(const [name,alter]of [['changed_claim',p=>p.storageProof[0].value='0xdead'],['missing_slot',p=>p.storageProof.pop()],['changed_proof_node',p=>p.accountProof[0]=p.accountProof[0].slice(0,-2)+'00']]){const copy=structuredClone(sample.proof);alter(copy);assert.throws(()=>inspectEthereumStateProof(copy,selection));negativeControls.push(name);}
assert.throws(()=>inspectEthereumStateProof(sample.proof,{...selection,stateRoot:capture.blocks.at(-1).block.stateRoot}));negativeControls.push('original_anvil_root_rejected');
// Native-account proofs are checked independently of the arithmetic tracker.
const nativeProofs=[];
for(const [address,balance]of Object.entries(native)){const raw=await getMerkleStateProof(stateManager,createAddressFromString(address),[]);const proof={...raw,balance:'0x'+BigInt(raw.balance).toString(16),nonce:'0x'+BigInt(raw.nonce).toString(16)};const checked=inspectEthereumStateProof(proof,{stateRoot:root,address,storageKeys:[]});assert.equal(BigInt(checked.balance),balance);nativeProofs.push({address,balance:String(balance),nonce:checked.nonce,proof});}
assert.equal(Object.values(native).reduce((a,b)=>a+b,0n)+burned,Object.values(genesis.alloc).reduce((a,b)=>a+BigInt(b.balance),0n),'NATIVE_CONSERVATION');
const first=history[0].transaction,header=blocks[0].block;
const context=createBlock({header:{number:BigInt(header.number),timestamp:BigInt(header.timestamp),gasLimit:BigInt(header.gasLimit),baseFeePerGas:BigInt(header.baseFeePerGas),coinbase:header.miner}},{common});
await assert.rejects(()=>runTx(vm,{tx:createTxFromRLP(bytes(first.encoded),{common}),block:context}));assert.equal(hex(await stateManager.getStateRoot()),root);negativeControls.push('spent_nonce_rejected_without_state_change');
const emptyVM=await createVM({common,stateManager:new MerkleStateManager()});await assert.rejects(()=>runTx(emptyVM,{tx:createTxFromRLP(bytes(first.encoded),{common}),block:context}));negativeControls.push('unfunded_sender_rejected');
assert.throws(()=>createTxFromRLP(bytes(first.encoded),{common:createCustomCommon({chainId:1},Mainnet,{hardfork:Hardfork.Shanghai})}));negativeControls.push('wrong_chain_rejected');
const report={schema:'caw-independent-signed-transaction-lifecycle/1',transactions:rows.length,successful:rows.filter(x=>x.status==='0x1').length,expectedReverts:rows.filter(x=>x.status==='0x0').length,logsAndReceiptGasMatched:true,totalGas:String(totalGas),baseFeeBurn:String(burned),nativeAccounts:nativeProofs.map(({address,balance,nonce})=>({address,balance,nonce})),provedStorageFields:21,provedNativeAccounts:nativeProofs.length,zeroFieldsProvenAbsent:2,localExecutionStateRoot:root,values,negativeControls,fullTransactionProcessorUsed:true,nativeGasAccounting:true,fullBlockReplay:false,originalHeaderStateRootRepaired:false,endpointAuthenticated:false,consensusVerified:false};
fs.writeFileSync(out+'/accounting.json',JSON.stringify(model,null,2)+'\n');
fs.writeFileSync(out+'/result.json',JSON.stringify(report,null,2)+'\n');fs.writeFileSync(out+'/execution.json',JSON.stringify({rows,proofs,nativeProofs},null,2)+'\n');console.log(JSON.stringify(report));
