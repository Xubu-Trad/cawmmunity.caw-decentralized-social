// Check the receiver's event index against receipts committed by the selected branch.
import {decodeRlp,encodeRlp,keccak256,toQuantity} from 'ethers';
import {encodeHeader,readBlockEntry} from './single-post-proof.mjs';
import {capsuleEnvelopeRoot,computedBloom} from './verify-post-capsule.mjs';

function root(entries){
  if(entries.length===1)return keccak256(encodeRlp(['0x2080',entries[0]]));
  return capsuleEnvelopeRoot(entries);
}

async function receiptEvents(rpc,block,address,topic){
  if(!Array.isArray(block.transactions) || block.transactions.length<1 || block.transactions.length>32)
    throw Error('Cannot verify feed completeness in this candidate block (expected 1–32 transactions).');
  const transactions=[],receipts=[],events=[];
  let logIndex=0,size=0;
  for(let i=0;i<block.transactions.length;i++){
    const {txBytes,receipt}=await readBlockEntry(rpc,block,i);
    size+=txBytes.length+receipt.length;
    if(size>524288)throw Error('Feed completeness evidence exceeds the block size limit.');
    transactions.push(txBytes);receipts.push(receipt);
    const typed=parseInt(receipt.slice(2,4),16)<128;
    const logs=decodeRlp(typed?'0x'+receipt.slice(4):receipt)[3];
    for(const [emitter,topics,data] of logs){
      if(emitter===address.toLowerCase() && topics[0]===topic)
        events.push({address:emitter,topics,data,blockHash:block.hash,blockNumber:block.number,
          transactionHash:block.transactions[i],transactionIndex:toQuantity(i),logIndex:toQuantity(logIndex)});
      logIndex++;
    }
  }
  if(root(transactions)!==block.transactionsRoot || root(receipts)!==block.receiptsRoot)
    throw Error('Feed completeness check failed: block transactions or receipts disagree with the header.');
  return events;
}

export async function* completeFeedLogs(rpc,head,address,topic,label){
  const height=BigInt(head.number);
  if(height>4095n)throw Error('This disposable-chain reader supports heights through 4095.');
  const mask=computedBloom([[address,[topic],'0x']]);
  let expectedHash=head.hash;
  for(let last=Number(height);last>=0;){
    const first=Math.floor(last/32)*32;
    const expected=new Map();
    for(let n=last;n>=first;n--){
      const block=await rpc('eth_getBlockByHash',[expectedHash,false]);
      if(block?.hash!==expectedHash || block.number!==toQuantity(n))throw Error('Incomplete feed header chain.');
      encodeHeader(block);
      expectedHash=block.parentHash;
      if((BigInt(block.logsBloom)&mask)!==mask)continue;
      for(const event of await receiptEvents(rpc,block,address,topic))
        expected.set(event.blockHash+':'+event.logIndex,event);
    }
    const logs=await rpc('eth_getLogs',[{address,topics:[topic],fromBlock:toQuantity(first),toBlock:toQuantity(last)}]);
    for(const log of logs){
      const key=log.blockHash+':'+log.logIndex;
      const event=expected.get(key);
      if(!event || log.removed || log.transactionHash!==event.transactionHash ||
         log.transactionIndex!==event.transactionIndex || log.address.toLowerCase()!==event.address ||
         JSON.stringify(log.topics)!==JSON.stringify(event.topics) || log.data!==event.data)
        throw Error('Feed discovery event disagrees with the verified receipts.');
      if(log.blockNumber!==event.blockNumber)throw Error(label+' height disagrees with the verified block header.');
      expected.delete(key);
      yield event;
    }
    if(expected.size)throw Error('Incomplete feed: the node omitted a '+label.toLowerCase()+' event recorded in the verified receipts.');
    last=first-1;
  }
}
