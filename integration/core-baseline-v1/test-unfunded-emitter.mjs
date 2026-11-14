import fs from 'node:fs';
import assert from 'node:assert/strict';
import solc from 'solc';
import {Wallet,Interface,keccak256,version} from 'ethers';
import {createVM,runTx} from '@ethereumjs/vm';
import {createTxFromRLP} from '@ethereumjs/tx';
import {createBlock} from '@ethereumjs/block';
import {MerkleStateManager} from '@ethereumjs/statemanager';
import {createCustomCommon,Mainnet,Hardfork} from '@ethereumjs/common';
import {Account,createAddressFromString} from '@ethereumjs/util';
import {bindCandidateAdmission} from './c007-admission-binding.mjs';
import {decodeCandidateLog} from './c007-claim-event-codec.mjs';
const [sourcePath,out,vectorsPath]=process.argv.slice(2);assert(!fs.existsSync(out));fs.mkdirSync(out);
assert.equal(version,'6.16.0');assert.equal(solc.version(),'0.8.30+commit.73712a01.Emscripten.clang');
const input={language:'Solidity',sources:{'UnfundedEmitterResearch.sol':{content:fs.readFileSync(sourcePath,'utf8')}},settings:{optimizer:{enabled:true,runs:200},evmVersion:'shanghai',outputSelection:{'*':{'*':['abi','evm.bytecode.object','evm.deployedBytecode.object']}}}};
const compiled=JSON.parse(solc.compile(JSON.stringify(input)));assert(!(compiled.errors??[]).some(e=>e.severity==='error'),JSON.stringify(compiled.errors));
const artifacts=compiled.contracts['UnfundedEmitterResearch.sol'];
const bytes=h=>Uint8Array.from(Buffer.from(h.slice(2),'hex')),hex=b=>'0x'+Buffer.from(b).toString('hex');
// Publicly known disposable fixture key, local VM only. Never broadcast.
const wallet=new Wallet('0x'+'0'.repeat(63)+'3'),sender=createAddressFromString(wallet.address);
const common=createCustomCommon({chainId:31337},Mainnet,{hardfork:Hardfork.Shanghai});
const stateManager=new MerkleStateManager();await stateManager.putAccount(sender,new Account(0n,10n**20n));
const vm=await createVM({common,stateManager});
const block=createBlock({header:{number:1n,gasLimit:30000000n,baseFeePerGas:1n,timestamp:1n,difficulty:0n},withdrawals:[]},{common});
let nonce=0;const operations=[];
async function send(data,to){
 const raw=await wallet.signTransaction({type:2,chainId:31337,nonce:nonce++,gasLimit:5000000,maxFeePerGas:2,maxPriorityFeePerGas:1,value:0,data,...(to?{to}:{})});
 const tx=createTxFromRLP(bytes(raw),{common});assert(tx.verifySignature());assert.equal(tx.getSenderAddress().toString(),wallet.address.toLowerCase());
 const result=await runTx(vm,{tx,block});assert.equal(result.receipt.status,1);assert(!result.execResult.exceptionError);
 operations.push({transactionHash:hex(tx.hash()),rawTransaction:raw,receiptStatus:1,gasUsed:result.totalGasSpent.toString(),logs:result.execResult.logs.map(([a,t,d])=>({address:hex(a),topics:t.map(hex),data:hex(d)}))});
 return result;
}
const t=await send('0x'+artifacts.UnfundedTokenFixture.evm.bytecode.object);const token=t.createdAddress;assert(token);
const emitterAbi=new Interface(artifacts.UnfundedEmitterResearch.abi),tokenAbi=new Interface(artifacts.UnfundedTokenFixture.abi);
const deployment=await send('0x'+artifacts.UnfundedEmitterResearch.evm.bytecode.object+emitterAbi.encodeDeploy([token.toString()]).slice(2));
const emitter=deployment.createdAddress;assert(emitter);
async function balance(address){
 const stateBefore=hex(await stateManager.getStateRoot()),nonceBefore=(await stateManager.getAccount(sender)).nonce;
 await stateManager.checkpoint();
 try {
  const x=await vm.evm.runCall({to:token,caller:sender,data:bytes(tokenAbi.encodeFunctionData('balanceOf',[address])),gasLimit:100000n,isStatic:true});
  assert(!x.execResult.exceptionError);return tokenAbi.decodeFunctionResult('balanceOf',hex(x.execResult.returnValue))[0];
 } finally {
  await stateManager.revert();
  assert.equal(hex(await stateManager.getStateRoot()),stateBefore,'READ_STATE_PRESERVED');
  assert.equal((await stateManager.getAccount(sender)).nonce,nonceBefore,'READ_NONCE_PRESERVED');
 }
}
const before={payer:await balance(wallet.address),emitter:await balance(emitter.toString())};
assert.deepEqual(before,{payer:100n,emitter:0n});
const vector=JSON.parse(fs.readFileSync(vectorsPath)).vectors[0];
await send(emitterAbi.encodeFunctionData('emitWithoutPayment',[vector.stakeRoot]),emitter.toString());
const after={payer:await balance(wallet.address),emitter:await balance(emitter.toString())};assert.deepEqual(after,before);
const logs=operations.at(-1).logs;assert.equal(logs.length,2);
const context={chainId:'31337',emitter:emitter.toString(),profile:vector.selection.profile};
const admission=bindCandidateAdmission(logs[0],context),claim=decodeCandidateLog(logs[1],context.emitter);
assert.equal(admission.fee,'5');assert.equal(claim.amount,'4');assert.equal(admission.recordId,claim.recordId);
assert.equal(admission.verification,'RESEARCH_RECORD_CONSISTENCY_ONLY');assert.equal(claim.verification,'UNVERIFIED_EVENT_LAYOUT_ONLY');
// Gas was paid in local native fixture currency; no mock-token fee was paid.
assert.equal(before.payer-after.payer,0n);assert.equal(after.emitter-before.emitter,0n);
const report={status:'EXECUTED_LOCAL_UNFUNDED_NEGATIVE_CONTROL',localTransactions:operations.length,
 token:token.toString(),emitter:emitter.toString(),emitterRuntimeKeccak:keccak256(await stateManager.getCode(emitter)),
 emittedAdmissionFee:admission.fee,emittedClaimAmount:claim.amount,
 mockTokenBefore:{payer:'100',emitter:'0'},mockTokenAfter:{payer:'100',emitter:'0'},
 localEvmExecutionCompleted:true,feeBackingVerified:false,cawActionAuthorityVerified:false,
 limits:'Single EthereumJS local VM, disposable native funds and mock token. Not canonical chain, independent execution engine, real CAW or accepted funded admission.'};
fs.writeFileSync(out+'/compiler-input.json',JSON.stringify(input,null,2)+'\n');
fs.writeFileSync(out+'/operations.json',JSON.stringify(operations,null,2)+'\n');
fs.writeFileSync(out+'/result.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
