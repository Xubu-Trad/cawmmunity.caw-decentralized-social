import {open,rm} from 'node:fs/promises';
import {decodeRlp,encodeRlp,keccak256,toBeHex,toQuantity} from 'ethers';
import {createLocalRpc} from '../local-rpc.mjs';

const [endpoint,tip,expectedHash,out]=process.argv.slice(2);
if(!out||!/^\d+$/.test(tip)||!Number.isSafeInteger(Number(tip))||!/^0x[\da-f]{64}$/.test(expectedHash))throw Error('Usage: node export-blocks.mjs LOOPBACK_RPC HEIGHT BLOCK_HASH NEW_FILE');
const rpc=createLocalRpc(endpoint);
if(await rpc('eth_chainId',[])!=='0x539')throw Error('Disposable chain required');
const numbers=new Set('difficulty number gasLimit gasUsed timestamp baseFeePerGas blobGasUsed excessBlobGas'.split(' '));
const fields='parentHash sha3Uncles miner stateRoot transactionsRoot receiptsRoot logsBloom difficulty number gasLimit gasUsed timestamp extraData mixHash nonce baseFeePerGas withdrawalsRoot blobGasUsed excessBlobGas parentBeaconBlockRoot requestsHash'.split(' ');
const num=x=>BigInt(x)===0n?'0x':toBeHex(x);
const handle=await open(out,'wx');
try{
  let last=(await rpc('eth_getBlockByNumber',['0x0',false])).hash;
  for(let height=1;height<=Number(tip);height++){
    const b=await rpc('eth_getBlockByNumber',[toQuantity(height),false]);
    const hdr=fields.filter(k=>b[k]!=null).map(k=>numbers.has(k)?num(b[k]):b[k]);
    if(b.parentHash!==last||keccak256(encodeRlp(hdr))!==b.hash||b.uncles.length)throw Error('Header mismatch at '+height);
    const txs=[];
    for(const hash of b.transactions){
      const raw=await rpc('eth_getRawTransactionByHash',[hash]);
      if(keccak256(raw)!==hash)throw Error('Signed transaction mismatch');
      txs.push(parseInt(raw.slice(2,4),16)>=192?decodeRlp(raw):raw);
    }
    const block=[hdr,txs,[]];
    if(b.withdrawals)block.push(b.withdrawals.map(w=>[num(w.index),num(w.validatorIndex),w.address,num(w.amount)]));
    await handle.writeFile(Buffer.from(encodeRlp(block).slice(2),'hex'));last=b.hash;
  }
  if(last!==expectedHash)throw Error('Checkpoint mismatch');
  await handle.close();
}catch(error){await handle.close();await rm(out);throw error;}
