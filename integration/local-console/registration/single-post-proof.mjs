import {concat,encodeRlp,keccak256,toBeHex} from 'ethers';
const quantity=n=>BigInt(n)===0n?'0x':toBeHex(BigInt(n));
export async function singlePostProof(rpc,post,latest){
  const b=await rpc('eth_getBlockByHash',[post.blockHash,false]);
  const hash=post.hash;
  if(b?.transactions?.[0]!==hash)throw Error("Selected post missing from block.");
  if(BigInt(latest)-BigInt(b.number)>=256n||b.transactions.length!==1)throw Error('First recognition requires a single-transaction post block within the last 256 blocks.');
  return {height:post.block,...await singletonEvidence(rpc,b,hash)};
}

// An offline reader can also use this committed evidence after the BLOCKHASH window expires.
export async function singletonEvidence(rpc,b,hash){
  if(b.transactions.length!==1 || b.transactions[0]!==hash)throw Error('Expected a single-transaction post block.');
  const header=encodeHeader(b);
  const {txBytes,receipt}=await readBlockEntry(rpc,b,0);
  const leaf=raw=>keccak256(encodeRlp(['0x2080',raw]));
  if(leaf(txBytes)!==b.transactionsRoot||leaf(receipt)!==b.receiptsRoot)throw Error('Post inclusion mismatch');
  return {header,txBytes,receipt};
}

export function encodeHeader(b){
  const keys=['parentHash','sha3Uncles','miner','stateRoot','transactionsRoot','receiptsRoot','logsBloom','difficulty','number','gasLimit','gasUsed','timestamp','extraData','mixHash','nonce','baseFeePerGas','withdrawalsRoot','blobGasUsed','excessBlobGas','parentBeaconBlockRoot','requestsHash'];
  const nums=new Set(['difficulty','number','gasLimit','gasUsed','timestamp','baseFeePerGas','blobGasUsed','excessBlobGas']);
  const header=encodeRlp(keys.filter(k=>b[k]!=null).map(k=>nums.has(k)?quantity(b[k]):b[k]));
  if(keccak256(header)!==b.hash)throw Error('Header mismatch');
  return header;
}

function encodeReceipt(rc){
  const payload=encodeRlp([quantity(rc.status),quantity(rc.cumulativeGasUsed),rc.logsBloom,rc.logs.map(l=>[l.address,l.topics,l.data])]);
  return BigInt(rc.type)?concat([quantity(rc.type),payload]):payload;
}

export async function readBlockEntry(rpc,block,index){
  const hash=block.transactions[index];
  const [txBytes,rc]=await Promise.all([
    rpc('eth_getRawTransactionByHash',[hash]),
    rpc('eth_getTransactionReceipt',[hash])
  ]);
  if(!rc || rc.transactionHash!==hash || rc.blockHash!==block.hash ||
     rc.blockNumber!==block.number || rc.transactionIndex!=='0x'+index.toString(16) ||
     keccak256(txBytes)!==hash)throw Error('Block entry mismatch at index '+index);
  return {txBytes,receipt:encodeReceipt(rc)};
}
