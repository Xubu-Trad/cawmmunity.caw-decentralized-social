import fs from 'node:fs';import assert from 'node:assert/strict';import {Transaction,Interface} from 'ethers';
import {verifyOwnerPostBlock,reconstructOwnerPostSequence} from './post-authority-sequence.mjs';
const {ownerBundle:b,selection:s,before,result}=JSON.parse(fs.readFileSync(process.argv[2]));
assert.deepEqual(verifyOwnerPostBlock(b,s),result);const checks=['fresh safe-transfer block verifies'];
const abi=new Interface(['function execute(address,bytes)','function safeTransferFrom(address,address,uint256)','function safeTransferFrom(address,address,uint256,bytes)','event Approval(address indexed owner,address indexed approved,uint256 indexed tokenId)','event Transfer(address indexed from,address indexed to,uint256 indexed tokenId)']);
const txs=b.rawTransactions.map(raw=>{const t=Transaction.from(raw);return {from:t.from.toLowerCase(),to:t.to.toLowerCase(),data:t.data,value:String(t.value),hash:t.hash}});
const start={owner:before.owner,epoch:before.epoch,nonce:before.nonce};
const wrap=inner=>abi.encodeFunctionData('execute',[s.contracts.registry.address,inner]);
for(const [name,change,error]of[
 ['four-argument callback data',t=>t[0].data=wrap(abi.encodeFunctionData('safeTransferFrom(address,address,uint256,bytes)',[start.owner,s.controller,2,'0x'])),'TRANSFER_CALLDATA'],
 ['trailing calldata',t=>t[0].data+='00','TRANSFER_CALLDATA'],
 ['wrong recipient',t=>t[0].data=wrap(abi.encodeFunctionData('safeTransferFrom(address,address,uint256)',[start.owner,'0x'+'11'.repeat(20),2])),'TRANSFER_CALLDATA'],
 ['delegate signer',t=>t[0].from='0x'+'11'.repeat(20),'CURRENT_OWNER_SIGNER']
]){const t=structuredClone(txs);change(t);assert.throws(()=>reconstructOwnerPostSequence(t,b.receipts,start,s,()=>{}),e=>e.message.includes(error));checks.push(name+' rejected');}
const t=structuredClone(txs).slice(0,1),r=structuredClone(b.receipts).slice(0,1),owner=s.controller,next=s.contracts.wallet.address;
t[0]={...t[0],from:owner,to:s.contracts.registry.address,data:abi.encodeFunctionData('safeTransferFrom(address,address,uint256)',[owner,next,2])};
const event=(name,args)=>({address:s.contracts.registry.address,...abi.encodeEventLog(abi.getEvent(name),args)});r[0].logs=[event('Approval',[owner,'0x'+'00'.repeat(20),2]),event('Transfer',[owner,next,2])];
assert.throws(()=>reconstructOwnerPostSequence(t,r,{owner,epoch:'2',nonce:'1'},s,()=>{}),e=>e.message.includes('SAFE_RECEIVER_CALLBACK_UNSUPPORTED'));checks.push('fixture contract receiver callback rejected');
console.log(JSON.stringify({passed:checks.length,checks,scope:'Positive uses signed mined evidence; malformed-call controls exercise semantic reducer, not newly mined attacks.'},null,2));
