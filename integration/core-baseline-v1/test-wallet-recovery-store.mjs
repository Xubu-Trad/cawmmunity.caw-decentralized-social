import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {recoverWalletFromChunks,readRecoveredWallet} from './wallet-recovery-store.mjs';
const [evidence,out]=process.argv.slice(2);await fs.mkdir(out);const selection=await fs.readFile(evidence+'/selection.json','utf8'),good=await fs.readFile(evidence+'/bundle.json');const replacement=Buffer.from(JSON.stringify(JSON.parse(good),null,1));
async function* chunks(b){for(let i=0;i<b.length;i+=4096)yield b.subarray(i,i+4096);}
await recoverWalletFromChunks(chunks(good),selection,out);const expected=await readRecoveredWallet(out,selection),cases=[];
for(const point of ['chunk','staged','verified','renamed','directory-synced']){
 await recoverWalletFromChunks(chunks(good),selection,out);await assert.rejects(recoverWalletFromChunks(chunks(replacement),selection,out,async at=>{if(at===point)throw Error('INJECTED_STOP');}),/INJECTED_STOP/);
 assert.deepEqual(await readRecoveredWallet(out,selection),expected);assert.deepEqual(await fs.readFile(out+'/wallet.json'),['renamed','directory-synced'].includes(point)?replacement:good);cases.push(point);
}
async function* broken(){yield good.subarray(0,4096);throw Error('PEER_LOST');}
await assert.rejects(recoverWalletFromChunks(broken(),selection,out),/PEER_LOST/);assert.deepEqual(await readRecoveredWallet(out,selection),expected);
await assert.rejects(recoverWalletFromChunks(chunks(good.subarray(0,good.length-1)),selection,out));assert.deepEqual(await readRecoveredWallet(out,selection),expected);
await assert.rejects(recoverWalletFromChunks(chunks(Buffer.alloc(524289)),selection,out),/DELIVERY_LIMIT/);assert.deepEqual(await readRecoveredWallet(out,selection),expected);
const corrupt=JSON.parse(good);corrupt.accounts[3].code='0x00';await assert.rejects(recoverWalletFromChunks(chunks(Buffer.from(JSON.stringify(corrupt))),selection,out));assert.deepEqual(await readRecoveredWallet(out,selection),expected);
await fs.writeFile(out+'/.wallet-stage-leftover','interrupted');assert.deepEqual(await readRecoveredWallet(out,selection),expected);await recoverWalletFromChunks(chunks(replacement),selection,out);assert.deepEqual(await readRecoveredWallet(out,selection),expected);
console.log(JSON.stringify({checkpoints:cases,peerLossRejected:true,truncationRejected:true,oversizeRejected:true,corruptReplacementRejected:true,orphanStageIgnored:true,replacementAccepted:true,fields:expected.fields,limits:'deterministic exception injection on local filesystem; not process kill, power loss, multiwriter or network transport certification'},null,2));
