// Local Shanghai block construction and a fresh replay using the same VM library.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createVM,buildBlock,runBlock} from '@ethereumjs/vm';
import {createTxFromRLP} from '@ethereumjs/tx';
import {createBlock,createBlockFromRLP} from '@ethereumjs/block';
import {MerkleStateManager,getMerkleStateProof} from '@ethereumjs/statemanager';
import {createCustomCommon,Mainnet,Hardfork} from '@ethereumjs/common';
import {Account,createAddressFromString} from '@ethereumjs/util';
import {inspectExecutionHeaderChain} from '../../reference/ethereum-execution-header.mjs';
import {inspectBlockTransactionReceipts} from '../../reference/ethereum-block-transactions.mjs';
import {inspectBlockSenders} from '../../reference/ethereum-block-senders.mjs';
import {inspectEthereumStateProof} from '../../reference/ethereum-state-proof.mjs';
const [directory,out]=process.argv.slice(2);assert(directory&&out&&!fs.existsSync(out));fs.mkdirSync(out);
const read=n=>{const p=directory+'/'+n;assert(fs.statSync(p).size<8*1024**2);return JSON.parse(fs.readFileSync(p));};
const capture=read('acquired-history.json'),genesis=read('genesis.json'),previous=read('transaction-result.json');assert.equal(capture.chainId,'0x7a69');
const bytes=h=>Uint8Array.from(Buffer.from(h.slice(2),'hex')),hex=b=>'0x'+Buffer.from(b).toString('hex');
const blocks=capture.blocks.slice(1);assert.equal(blocks.length,38);
inspectExecutionHeaderChain(blocks.map(b=>b.block),{schema:'caw-execution-header-chain-selection/1',profile:'shanghai-17',startHash:blocks[0].block.hash,endHash:blocks.at(-1).block.hash});
const common=createCustomCommon({chainId:31337},Mainnet,{hardfork:Hardfork.Shanghai});
async function fresh(){const stateManager=new MerkleStateManager();for(const [a,x]of Object.entries(genesis.alloc)){assert.deepEqual(Object.keys(x),['balance']);await stateManager.putAccount(createAddressFromString(a.startsWith('0x')?a:'0x'+a),new Account(0n,BigInt(x.balance)));}return createVM({common,stateManager});}
const producer=await fresh(),consumer=await fresh();assert.equal(hex(await producer.stateManager.getStateRoot()),hex(await consumer.stateManager.getStateRoot()));
const initial=capture.blocks[0].block;
// Synthetic empty genesis: derive its fee so normal EIP-1559 progression
// reaches the captured first block. This is not the original Anvil genesis.
const firstFee=BigInt(blocks[0].block.baseFeePerGas);
const genesisFee=firstFee*8n/7n;
assert.equal(genesisFee-genesisFee/8n,firstFee,'GENESIS_FEE_PREIMAGE');
const origin=createBlock({header:{number:0n,stateRoot:await producer.stateManager.getStateRoot(),timestamp:BigInt(initial.timestamp),gasLimit:BigInt(initial.gasLimit),baseFeePerGas:genesisFee,coinbase:initial.miner,difficulty:0n},withdrawals:[]},{common});
let parent=origin;const records=[];
function validateHeader(header,prior){assert.equal(hex(header.parentHash),hex(prior.hash()),'PARENT');assert.equal(header.number,prior.header.number+1n,'NUMBER');assert(header.timestamp>prior.header.timestamp,'TIMESTAMP');assert.equal(header.gasLimit,prior.header.gasLimit,'FIXED_GAS_LIMIT');assert.equal(header.baseFeePerGas,prior.header.calcNextBaseFee(),'BASE_FEE');assert.equal(header.difficulty,0n);assert(header.nonce.every(x=>x===0));assert(header.extraData.length<=32);}
// Explicit bounded local header policy; no beacon-chain authentication.
consumer.blockchain.validateHeader=async header=>validateHeader(header,parent);
for(const input of blocks){
 const h=input.block;
 const joined=inspectBlockTransactionReceipts(h,input.rawTransactions,input.receipts,{schema:'caw-block-transactions-selection/1',profile:'shanghai-17',hash:h.hash});
 const senders=inspectBlockSenders(h,input.rawTransactions,{schema:'caw-block-senders-selection/1',profile:'shanghai-17',hash:h.hash,chainId:'0x7a69',allowUnprotectedLegacy:false});assert.equal(senders.transactionCount,1);
 assert.deepEqual(h.withdrawals,[],'WITHDRAWAL_SCOPE');
 const timestamp=BigInt(h.timestamp)>parent.header.timestamp?BigInt(h.timestamp):parent.header.timestamp+1n;
 const builder=await buildBlock(producer,{parentBlock:parent,headerData:{timestamp,gasLimit:BigInt(h.gasLimit),coinbase:h.miner,mixHash:h.mixHash},withdrawals:[],blockOpts:{putBlockIntoBlockchain:false}});
 const tx=createTxFromRLP(bytes(input.rawTransactions[0]),{common});assert.equal(tx.getSenderAddress().toString(),senders.transactions[0].from);const produced=await builder.addTransaction(tx);const {block}=await builder.build();validateHeader(block.header,parent);
 assert.equal(block.header.baseFeePerGas,BigInt(h.baseFeePerGas));assert.equal(block.header.gasUsed,BigInt(h.gasUsed));assert.equal(hex(block.header.transactionsTrie),h.transactionsRoot);assert.equal(hex(block.header.receiptTrie),h.receiptsRoot);assert.equal(hex(block.header.logsBloom),h.logsBloom);
 const decoded=createBlockFromRLP(block.serialize(),{common});const result=await runBlock(consumer,{block:decoded,generate:false});
 assert.equal(hex(result.stateRoot),hex(block.header.stateRoot));assert.equal(hex(await consumer.stateManager.getStateRoot()),hex(await producer.stateManager.getStateRoot()));assert.equal(result.receipts[0].status,Number(BigInt(joined.receipts[0].status)));
 records.push({capturedTimestamp:h.timestamp,timestamp:String(timestamp),number:String(block.header.number),hash:hex(block.hash()),stateRoot:hex(block.header.stateRoot),transactionsRoot:hex(block.header.transactionsTrie),receiptsRoot:hex(block.header.receiptTrie),gasUsed:String(block.header.gasUsed),baseFeePerGas:String(block.header.baseFeePerGas),serialized:hex(block.serialize())});parent=block;
}
const finalRoot=hex(await consumer.stateManager.getStateRoot());assert.equal(finalRoot,previous.localExecutionStateRoot,'TRANSACTION_REPLAY_FINAL_ROOT');
const controls=[];
const controlVM=await fresh();controlVM.blockchain.validateHeader=async h=>validateHeader(h,origin);const controlBlock=createBlockFromRLP(bytes(records[0].serialized),{common});await runBlock(controlVM,{block:createBlock({header:controlBlock.header.toJSON(),transactions:controlBlock.transactions,withdrawals:[]},{common}),generate:false});
// Each corruption test uses a separately initialized VM and cannot contaminate replay.
async function reject(name,alter){const vm=await fresh();vm.blockchain.validateHeader=async h=>validateHeader(h,origin);const good=createBlockFromRLP(bytes(records[0].serialized),{common});const data={header:good.header.toJSON(),transactions:good.transactions,withdrawals:[]};alter(data);await assert.rejects(async()=>runBlock(vm,{block:createBlock(data,{common}),generate:false}));controls.push(name);}
await reject('wrong_parent',d=>d.header.parentHash='0x'+'11'.repeat(32));
await reject('nonincreasing_timestamp',d=>d.header.timestamp='0x0');
await reject('wrong_base_fee',d=>d.header.baseFeePerGas='0x1');
await reject('wrong_state_root',d=>d.header.stateRoot='0x'+'11'.repeat(32));
await reject('wrong_receipt_root',d=>d.header.receiptTrie='0x'+'11'.repeat(32));
await reject('missing_transaction',d=>d.transactions=[]);
await reject('wrong_gas_used',d=>d.header.gasUsed='0x1');
const nativeProofs=[];
for(const account of previous.nativeAccounts){const raw=await getMerkleStateProof(consumer.stateManager,createAddressFromString(account.address),[]);const proof={...raw,nonce:'0x'+BigInt(raw.nonce).toString(16),balance:'0x'+BigInt(raw.balance).toString(16)};const checked=inspectEthereumStateProof(proof,{stateRoot:finalRoot,address:account.address,storageKeys:[]});assert.equal(BigInt(checked.balance),BigInt(account.balance));assert.equal(BigInt(checked.nonce),BigInt(account.nonce));nativeProofs.push(proof);}
const report={schema:'caw-local-block-build-replay/1',blocks:records.length,syntheticGenesisBaseFee:String(genesisFee),timestampPolicy:'max(captured timestamp, parent timestamp + 1)',timestampChanges:records.filter(r=>BigInt(r.capturedTimestamp)!==BigInt(r.timestamp)).length,positiveControlPassed:true,genesisHash:hex(origin.hash()),genesisStateRoot:hex(origin.header.stateRoot),finalHash:hex(parent.hash()),finalStateRoot:finalRoot,allReceiptsAndTransactionRootsMatchedCapture:true,allExecutionStateRootsMatchedFreshReplay:true,priorTransactionReplayFinalRootMatched:true,nativeAccountsRechecked:nativeProofs.length,negativeControls:controls,library:'EthereumJS 10.1.3',sameLibraryProducerAndConsumer:true,headerPolicy:'fixed-gas-limit Shanghai local parent/number/timestamp/base-fee checks',withdrawals:'explicitly empty',genesisScope:'three synthetic funded accounts; no original Anvil predeploy reconstruction',consensusAuthenticated:false,originalAnvilChainRepaired:false};
fs.writeFileSync(out+'/result.json',JSON.stringify(report,null,2)+'\n');fs.writeFileSync(out+'/blocks.json',JSON.stringify({genesis:hex(origin.serialize()),records,nativeProofs},null,2)+'\n');console.log(JSON.stringify(report));
