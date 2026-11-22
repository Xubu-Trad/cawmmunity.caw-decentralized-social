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
const method=n=>'0x'+contracts.SignerWalletFixture.evm.methodIdentifiers[Object.keys(contracts.SignerWalletFixture.evm.methodIdentifiers).find(x=>x.startsWith(n+'('))];
const forwards=history.map((x,i)=>[x,i]).filter(([x])=>x.receipt.status==='0x1'&&x.transaction.data.startsWith(method('execute'))).map(([,i])=>i);
assert(forwards.length>0);
function replaceWord(t,i,value){const start=10+i*64;t.data=t.data.slice(0,start)+BigInt(value).toString(16).padStart(64,'0')+t.data.slice(start+64);}
const negatives=[];
function reject(name,alter,label){const h=structuredClone(history);alter(h);assert.throws(()=>reconstruct(h,contracts,timestamps),e=>e.code==='ERR_ASSERTION'&&e.message.startsWith(label));negatives.push(name);}
reject('forward_from_wrong_controller',h=>h[forwards[0]].transaction.from=baseline.wallet,'WALLET_CONTROLLER');
reject('unexpected_forward_target',h=>replaceWord(h[forwards[0]].transaction,0,1),'FORWARD_TARGET');
reject('noncanonical_forward_offset',h=>replaceWord(h[forwards[0]].transaction,1,96),'FORWARD_OFFSET');
reject('truncated_forward',h=>{h[forwards[0]].transaction.data=h[forwards[0]].transaction.data.slice(0,-64);},'FORWARD_END');
const settle='0x'+Object.entries(contracts.DeployedCustodyStakeResearch.evm.methodIdentifiers).find(([s])=>s.startsWith('settleFixedPool1('))[1];
const successful=history.findIndex(x=>x.receipt.status==='0x1'&&x.transaction.data.startsWith(settle));
const failed=history.find(x=>x.receipt.status==='0x0'&&x.transaction.data.startsWith(settle));assert(successful>=0&&failed);
// The first rejected settlement has the same message and a different signer.
reject('wrong_application_signer',h=>{h[successful].transaction.data=failed.transaction.data;},'WALLET_SIGNER');
fs.writeFileSync(out,JSON.stringify({matchedCapturedLifecycleFinal:true,negatives,boundary:'Semantic model mutations only; edited rows are not cryptographically valid histories.'},null,2)+'\n');
console.log(JSON.stringify({negativeControls:negatives.length,matchedCapturedLifecycleFinal:true}));
