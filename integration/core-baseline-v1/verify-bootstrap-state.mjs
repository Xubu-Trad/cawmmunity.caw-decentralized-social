import fs from 'node:fs';import assert from 'node:assert/strict';
import {MerklePatriciaTrie} from '@ethereumjs/mpt';import {RLP} from '@ethereumjs/rlp';
import {keccak256Hex} from '../../reference/keccak256.mjs';import {inspectExecutionHeader} from '../../reference/ethereum-execution-header.mjs';
const state=JSON.parse(fs.readFileSync(process.argv[2])),capture=JSON.parse(fs.readFileSync(process.argv[3]));
const bytes=x=>Uint8Array.from(Buffer.from(x.slice(2),'hex')),hex=x=>'0x'+Buffer.from(x).toString('hex'),empty=()=>new Uint8Array();
const q=n=>{n=BigInt(n);if(!n)return empty();let x=n.toString(16);if(x.length%2)x='0'+x;return bytes('0x'+x);};
async function verify(state,header){
 const expected=['0x1eff47bc3a10a45d4b230b5d10e37751fe6aa718','0x6813eb9362372eef6200f3b1dbc3f819671cba69'];assert.deepEqual(Object.keys(state.accounts).sort(),expected);const tree=new MerklePatriciaTrie({useKeyHashing:true}),storage=new MerklePatriciaTrie();
 for(const a of expected){const x=state.accounts[a];assert.equal(x.nonce,0);assert.equal(BigInt(x.balance),10n**20n);assert.equal(x.code,'0x');assert.deepEqual(x.storage,{});await tree.put(bytes(a),RLP.encode([q(x.nonce),q(x.balance),storage.root(),bytes(keccak256Hex('0x'))]));}
 const checked=inspectExecutionHeader(header,{schema:'caw-execution-header-selection/1',profile:'shanghai-17',hash:header.hash});assert.equal(header.number,'0x1');assert.equal(header.transactions.length,0);assert.equal(hex(tree.root()),checked.stateRoot);return hex(tree.root());
}
const root=await verify(state,capture.blocks[0].block),controls=[];
for(const [name,mutate]of [['missing account',x=>delete x.accounts[Object.keys(x.accounts)[0]]],['changed balance',x=>x.accounts[Object.keys(x.accounts)[0]].balance='0x1'],['hidden account',x=>x.accounts['0x'+'11'.repeat(20)]={nonce:0,balance:'0x0',code:'0x',storage:{}}]]){const x=structuredClone(state);mutate(x);await assert.rejects(()=>verify(x,capture.blocks[0].block));controls.push(name);}
const h=structuredClone(capture.blocks[0].block);h.stateRoot='0x'+'11'.repeat(32);await assert.rejects(()=>verify(state,h));controls.push('changed header root');
console.log(JSON.stringify({root,accounts:2,bootstrapBlock:1,controls,genesisAuthenticated:false,chainAuthenticated:false,limits:'Full local starting allocation agrees with selected empty bootstrap block; this is not proof of genesis correctness, consensus or public finality.'},null,2));
