import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {decodeRlp,toQuantity} from 'ethers';
import {readFeedCheckpoint} from './read-feed-checkpoint.mjs';

const load=name=>JSON.parse(readFileSync(new URL('./samples/peer-check/'+name+'.json',import.meta.url)));
const {receiverCheckpoint}=load('result');
const {number:height,hash}=receiverCheckpoint;
const fields=decodeRlp(load('located').originalEvidence.headers[0]);
const names='parentHash sha3Uncles miner stateRoot transactionsRoot receiptsRoot logsBloom difficulty number gasLimit gasUsed timestamp extraData mixHash nonce baseFeePerGas withdrawalsRoot'.split(' ');
assert.equal(fields.length,names.length);
const quantities=new Set(['difficulty','number','gasLimit','gasUsed','timestamp','baseFeePerGas']);
const block={hash,...Object.fromEntries(names.map((key,i)=>[key,
  quantities.has(key)?toQuantity(fields[i]==='0x'?0:fields[i]):fields[i]]))};

function receiver(first,final=first,chain='0x539'){
  let reads=0;
  return async(method,args)=>{
    if(method==='eth_chainId')return chain;
    assert.equal(method,'eth_getBlockByNumber');
    assert.deepEqual(args,[height,false]);
    return reads++===0?first:final;
  };
}
assert.deepEqual(await readFeedCheckpoint(receiver(block),height),{height,hash});
await assert.rejects(readFeedCheckpoint(receiver(null),height),/lacks/);
await assert.rejects(readFeedCheckpoint(receiver({...block,number:'0x0'}),height),/lacks/);
await assert.rejects(readFeedCheckpoint(receiver({...block,gasUsed:'0x1'}),height),/Header mismatch/);
await assert.rejects(readFeedCheckpoint(receiver(block,{...block,hash:'0x'+'01'.repeat(32)}),height),/changed/);
await assert.rejects(readFeedCheckpoint(receiver(block,block,'0x1'),height),/1337/);
console.log('PASS: preserved receiver checkpoint and five rejection controls',height,hash);
