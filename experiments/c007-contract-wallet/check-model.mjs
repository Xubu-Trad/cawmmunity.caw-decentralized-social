import fs from 'node:fs';
import assert from 'node:assert/strict';
import {reconstruct} from './reconstruct-accounting.mjs';
const [historyFile,captureDir,out]=process.argv.slice(2);
const history=JSON.parse(fs.readFileSync(historyFile)).history;
const read=n=>JSON.parse(fs.readFileSync(captureDir+'/'+n));
const contracts=Object.assign({},...Object.values(read('compiler-output.json').contracts));
const timestamps=Object.fromEntries(read('acquired-history.json').blocks.map(x=>[x.block.hash,x.block.timestamp]));
const baseline=reconstruct(history,contracts,timestamps);
assert.deepEqual(baseline.final,read('results.json').final);
const method=n=>'0x'+contracts.LifecycleWalletFixture.evm.methodIdentifiers[Object.keys(contracts.LifecycleWalletFixture.evm.methodIdentifiers).find(x=>x.startsWith(n+'('))];
const configs=history.map((x,i)=>[x,i]).filter(([x])=>x.receipt.status==='0x1'&&x.transaction.data.startsWith(method('configure'))).map(([,i])=>i);
const forwards=history.map((x,i)=>[x,i]).filter(([x])=>x.receipt.status==='0x1'&&x.transaction.data.startsWith(method('execute'))).map(([,i])=>i);
assert.equal(configs.length,2);assert(forwards.length>0);
function replaceWord(t,i,value){const start=10+i*64;t.data=t.data.slice(0,start)+BigInt(value).toString(16).padStart(64,'0')+t.data.slice(start+64);}
const negatives=[];
function reject(name,alter,label){const h=structuredClone(history);alter(h);assert.throws(()=>reconstruct(h,contracts,timestamps),e=>e.code==='ERR_ASSERTION'&&e.message.startsWith(label));negatives.push(name);}
reject('configuration_from_wrong_controller',h=>h[configs[0]].transaction.from=baseline.wallet,'WALLET_CONTROLLER');
reject('forward_from_wrong_controller',h=>h[forwards[0]].transaction.from=baseline.wallet,'WALLET_CONTROLLER');
reject('unexpected_forward_target',h=>replaceWord(h[forwards[0]].transaction,0,1),'FORWARD_TARGET');
reject('noncanonical_forward_offset',h=>replaceWord(h[forwards[0]].transaction,1,96),'FORWARD_OFFSET');
reject('truncated_forward',h=>{h[forwards[0]].transaction.data=h[forwards[0]].transaction.data.slice(0,-64);},'FORWARD_END');
reject('wallet_rejects_successful_post',h=>replaceWord(h[configs[1]].transaction,2,1),'WALLET_REJECT');
reject('changed_wallet_digest',h=>replaceWord(h[configs[1]].transaction,0,1),'WALLET_DIGEST');
reject('changed_wallet_signature_hash',h=>replaceWord(h[configs[1]].transaction,1,1),'WALLET_SIGNATURE_HASH');
fs.writeFileSync(out,JSON.stringify({matchedCapturedLifecycleFinal:true,negatives,boundary:'Semantic model mutations only; edited rows are not cryptographically valid histories.'},null,2)+'\n');
console.log(JSON.stringify({negativeControls:negatives.length,matchedCapturedLifecycleFinal:true}));
