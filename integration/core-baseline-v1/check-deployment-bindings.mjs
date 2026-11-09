import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Transaction,AbiCoder,getCreateAddress,keccak256} from 'ethers';
const [dir,manifestFile]=process.argv.slice(2),load=n=>JSON.parse(fs.readFileSync(dir+'/'+n));
const m=JSON.parse(fs.readFileSync(manifestFile)),compiler=load('compiler-output.json'),history=load('acquired-history.json'),proofs=load('final-proof-batches.json');
const sha=b=>createHash('sha256').update(b).digest('hex'),abi=AbiCoder.defaultAbiCoder();
const artifacts=[];
for(const [source,names]of Object.entries(m.artifacts))for(const [name,pin]of Object.entries(names)){
 const a=compiler.contracts[source][name];assert.equal(sha(Buffer.from(a.evm.bytecode.object,'hex')),pin.creationSha256);
 assert.equal(sha(Buffer.from(a.evm.deployedBytecode.object,'hex')),pin.runtimeTemplateSha256);
 assert.deepEqual(a.evm.deployedBytecode.immutableReferences,pin.immutableReferences);
 artifacts.push({name,a});
}
function check(h){
 assert.equal(h.chainId,'0x7a69');const rows=[];
 for(const block of h.blocks)for(const [i,raw]of block.rawTransactions.entries()){
  const tx=Transaction.from(raw);if(tx.to!==null)continue;
  assert.equal(tx.chainId,31337n);assert(tx.signature&&tx.from);
  const receipt=block.receipts[i];assert.equal(receipt.transactionHash.toLowerCase(),keccak256(raw));assert.equal(receipt.status,'0x1');
  assert.equal(receipt.blockHash,block.block.hash);assert.equal(receipt.blockNumber,block.block.number);assert.equal(BigInt(receipt.transactionIndex),BigInt(i));
  const address=getCreateAddress({from:tx.from,nonce:tx.nonce}).toLowerCase();assert.equal(receipt.contractAddress.toLowerCase(),address,'CREATE_ADDRESS');
  const matches=artifacts.filter(x=>tx.data.startsWith('0x'+x.a.evm.bytecode.object));assert.equal(matches.length,1);
  const {name,a}=matches[0],tail='0x'+tx.data.slice(2+a.evm.bytecode.object.length);
  const types=name==='MockTokenResearch'?[]:name==='SignerWalletFixture'?['address']:['address','address[3]'];
  const args=abi.decode(types,tail);assert.equal(abi.encode(types,args),tail,'CONSTRUCTOR_ENCODING');
  let runtime=a.evm.deployedBytecode.object;
  for(const refs of Object.values(a.evm.deployedBytecode.immutableReferences))for(const ref of refs){assert.equal(ref.length,32);const value=abi.encode(['address'],[args[0]]).slice(2);runtime=runtime.slice(0,2*ref.start)+value+runtime.slice(2*(ref.start+ref.length));}
  const observed=proofs.batches.filter(b=>b.address.toLowerCase()===address);for(const b of observed)assert.equal(b.code,'0x'+runtime,'INSTANTIATED_RUNTIME');
  rows.push({name,address,sender:tx.from,nonce:tx.nonce,transactionHash:tx.hash,blockHash:block.block.hash,constructorArgs:Array.from(args,x=>Array.isArray(x)?Array.from(x):x),runtimeKeccak:keccak256('0x'+runtime),retainedRuntimeCompared:observed.length>0});
 }
 assert.equal(rows.length,4);const token=rows.filter(x=>x.name==='MockTokenResearch'),vault=rows.filter(x=>x.name==='DeployedCustodyStakeResearch'),wallets=rows.filter(x=>x.name==='SignerWalletFixture');assert.equal(token.length,1);assert.equal(vault.length,1);assert.equal(wallets.length,2);
 assert.equal(vault[0].constructorArgs[0].toLowerCase(),token[0].address);
 assert.deepEqual(vault[0].constructorArgs[1].map(x=>x.toLowerCase()),[wallets[0].address,...wallets.map(x=>x.constructorArgs[0].toLowerCase())],'OWNER_BINDINGS');return rows;
}
const rows=check(history),negativeControls=[];
for(const [name,mutate]of [['receipt address',h=>h.blocks[1].receipts[0].contractAddress='0x'+'11'.repeat(20)],['receipt hash',h=>h.blocks[1].receipts[0].transactionHash='0x'+'11'.repeat(32)],['chain',h=>h.chainId='0x1'],['receipt status',h=>h.blocks[1].receipts[0].status='0x0']]){const h=structuredClone(history);mutate(h);assert.throws(()=>check(h));negativeControls.push(name);}
console.log(JSON.stringify({rows,negativeControls,receiptInclusionReverified:false,accountProofReverified:false,lifecycleRerun:false,productionAccepted:false},null,2));
