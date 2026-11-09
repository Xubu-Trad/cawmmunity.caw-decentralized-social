import fs from 'node:fs';
import assert from 'node:assert/strict';
import {Transaction,AbiCoder,getCreateAddress} from 'ethers';
const [compiledFile,historyFile,bindingsFile]=process.argv.slice(2);
const compiled=JSON.parse(fs.readFileSync(compiledFile)),history=JSON.parse(fs.readFileSync(historyFile)),bindings=JSON.parse(fs.readFileSync(bindingsFile)).rows;
assert.equal(history.chainId,'0x7a69');const abi=AbiCoder.defaultAbiCoder(),seen=[];
for(const block of history.blocks)for(const raw of block.rawTransactions){
 const tx=Transaction.from(raw);assert.equal(tx.chainId,31337n);assert(tx.signature&&tx.from);
 if(tx.to!==null)continue;
 const addr=getCreateAddress({from:tx.from,nonce:tx.nonce}).toLowerCase(),selected=bindings.filter(x=>x.address===addr);assert.equal(selected.length,1);const row=selected[0];
 const candidates=Object.values(compiled.contracts).flatMap(x=>Object.entries(x)).filter(([n])=>n===row.name);assert.equal(candidates.length,1);
 const artifact=candidates[0][1],types=row.name==='MockTokenResearch'?[]:row.name==='SignerWalletFixture'?['address']:['address','address[3]'];
 assert.equal(tx.data,'0x'+artifact.evm.bytecode.object+abi.encode(types,row.constructorArgs).slice(2),'FROZEN_DEPLOYMENT_INPUT');
 assert.equal(tx.hash,row.transactionHash);assert(!seen.includes(addr));seen.push(addr);
}
assert.equal(seen.length,4);assert.equal(bindings.length,4);
console.log(JSON.stringify({signedCreationsBoundToRebuild:4,productionAccepted:false}));
