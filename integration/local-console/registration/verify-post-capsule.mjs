import {orderedEnvelopeRoot} from '../../../reference/ethereum-block-transactions.mjs';
import {readFileSync} from 'node:fs';
import {Interface,Transaction,decodeRlp,encodeRlp,formatEther,getAddress,id,isHexString,keccak256,parseEther,toBeHex} from 'ethers';

const manifest=JSON.parse(readFileSync(new URL('./disposable-runtime.json',import.meta.url),'utf8'));
const posts=manifest.contracts.posts.address,token=manifest.contracts.token.address;
const fee=parseEther('5000');
const pool=new Interface([
  'function publish(string name,string body)',
  'event Published(uint256 indexed tokenId,address indexed author,string name,string body,uint256 fee)',
  'event PoolSettled(uint256 eligibleWeight,uint256 recipients)',
  'event StakerPaid(address indexed staker,uint256 weight,uint256 amount)'
]);
const erc20=new Interface([
  'event Transfer(address indexed from,address indexed to,uint256 value)',
  'event Approval(address indexed owner,address indexed spender,uint256 value)'
]);

function requireMatch(ok,message){if(!ok)throw Error('Post capsule: '+message);}
function canonicalRlp(bytes){
  const decoded=decodeRlp(bytes);
  requireMatch(encodeRlp(decoded)===bytes,'noncanonical RLP');
  return decoded;
}
function singletonRoot(bytes){
  // Hex-prefix encoding of the leaf path for transaction index zero (RLP 0x80).
  return keccak256(encodeRlp(['0x2080',bytes]));
}
function readHeader(bytes){
  const h=canonicalRlp(bytes);
  // Post-Merge Shanghai execution header ending at withdrawalsRoot.
  const widths=[32,32,20,32,32,32,256,null,null,null,null,null,null,32,8,null,32];
  requireMatch(Array.isArray(h)&&h.length===widths.length,'expected Shanghai header');
  widths.forEach((width,i)=>{
    requireMatch(isHexString(h[i],width??true),'header field '+i);
  });
  for(const i of [7,8,9,10,11,15]){
    requireMatch(h[i].length<=66&&!h[i].startsWith('0x00'),'noncanonical header quantity');
  }
  requireMatch(h[12].length<=66,'oversized extra data');
  return h;
}
function eventReader(logs){
  let index=0;
  return {
    event(address,iface,eventName){
      const row=logs[index++];
      requireMatch(Array.isArray(row)&&row.length===3&&getAddress(row[0])===address,'unexpected emitter for '+eventName);
      const [,topics,data]=row;
      const event=iface.getEvent(eventName);
      requireMatch(Array.isArray(topics)&&topics[0]===event.topicHash,'expected '+eventName);
      const args=iface.decodeEventLog(event,data,topics);
      const encoded=iface.encodeEventLog(event,args);
      requireMatch(encoded.data===data&&encoded.topics.length===topics.length&&
        topics.every((topic,i)=>topic===encoded.topics[i]),'noncanonical '+eventName);
      return args;
    },
    nextIs(address,topic){const row=logs[index];return row?.[0]===address.toLowerCase() && row[1]?.[0]===topic;},
    done(){return index===logs.length;}
  };
}
function readCredits(logs,author,name,body){
  const events=eventReader(logs);
  const transfer=()=>events.event(token,erc20,'Transfer');
  const first=transfer();
  requireMatch(first.from===author&&first.to===posts&&first.value===fee,'post fee debit');
  const approval=events.event(token,erc20,'Approval');
  requireMatch(approval.owner===author&&approval.spender===posts,'approval owner or spender');
  const credits=[],seen=new Set();
  let weightSum=0n;
  while(!events.nextIs(posts,pool.getEvent('PoolSettled').topicHash)){
    requireMatch(credits.length<32,'too many stakers');
    const movement=events.nextIs(token,erc20.getEvent('Transfer').topicHash)?transfer():null;
    const {staker,weight,amount}=events.event(posts,pool,'StakerPaid');
    requireMatch(staker!==author&&!seen.has(staker)&&weight>0n,'invalid recipient or stake');
    requireMatch(movement?movement.from===posts&&movement.to===staker&&movement.value===amount&&amount>0n:amount===0n,'token credit');
    seen.add(staker);
    weightSum+=weight;
    credits.push({staker,weight,amount});
  }
  const {eligibleWeight,recipients}=events.event(posts,pool,'PoolSettled');
  requireMatch(weightSum>0n&&weightSum===eligibleWeight&&BigInt(credits.length)===recipients,'settlement totals');
  let cumulative=0n,distributed=0n;
  for(const {weight,amount} of credits){
    cumulative+=weight;
    const entitled=fee*cumulative/eligibleWeight;
    requireMatch(entitled-distributed===amount,'proportional credit');
    distributed=entitled;
  }
  const pub=events.event(posts,pool,'Published');
  requireMatch(events.done()&&pub.name===name&&pub.body===body&&pub.author===author&&
    pub.fee===fee&&pub.tokenId===BigInt(id(name)),'Published event');
  return credits.map(({staker,weight,amount})=>({staker,weight:formatEther(weight),amount:formatEther(amount)}));
}

function receiptForType(receipt,type){
  let encoded=receipt.toLowerCase();
  if(type!==0){
    requireMatch(encoded.startsWith(toBeHex(type,1)),'receipt type mismatch');
    encoded='0x'+encoded.slice(4);
  }
  const rc=canonicalRlp(encoded);
  requireMatch(Array.isArray(rc)&&rc.length===4&&['0x','0x01'].includes(rc[0])&&
    isHexString(rc[1],true)&&rc[1].length>2&&rc[1].length<=66&&!rc[1].startsWith('0x00')&&
    isHexString(rc[2],256)&&Array.isArray(rc[3]),'receipt status, gas or bloom');
  requireMatch(rc[0]!=='0x'||rc[3].length===0,'reverted transaction emitted logs');
  return rc;
}

function computedBloom(logs){
  let bloom=0n;
  for(const row of logs){
    requireMatch(Array.isArray(row)&&row.length===3&&isHexString(row[0],20)&&Array.isArray(row[1])&&
      row[1].length<=4&&row[1].every(topic=>isHexString(topic,32))&&isHexString(row[2],true),'invalid receipt log');
    for(const field of [row[0],...row[1]]){
      const digest=keccak256(field);
      for(const offset of [2,6,10]){
        const bit=parseInt(digest.slice(offset,offset+4),16)&2047;
        bloom|=1n<<BigInt(bit);
      }
    }
  }
  return bloom;
}

function boundedHex(value){
  requireMatch(typeof value==='string'&&value.length>2&&value.length<=131074&&isHexString(value,true),
    'invalid or oversized encoded bytes');
}

function readMixed(capsule,h,hash){
  const {transactions,receipts}=capsule;
  requireMatch(Array.isArray(transactions)&&Array.isArray(receipts)&&transactions.length>=2&&
    transactions.length<=32&&transactions.length===receipts.length,'mixed block length');
  let size=capsule.header.length;
  for(let i=0;i<transactions.length;i++){
    boundedHex(transactions[i]);boundedHex(receipts[i]);
    size+=transactions[i].length+receipts[i].length;
    requireMatch(size<=524288,'mixed archive size');
  }
  requireMatch(Buffer.byteLength(JSON.stringify(capsule))+1<=524288,'mixed archive size');
  const hashes=transactions.map(raw=>keccak256(raw));
  requireMatch(new Set(hashes).size===hashes.length,'duplicate transaction');
  const index=hashes.indexOf(hash);
  requireMatch(index!==-1,'transaction hash missing from block');
  const root=list=>orderedEnvelopeRoot(list.map(raw=>Buffer.from(raw.slice(2),'hex')));
  requireMatch(root(transactions)===h[4]&&root(receipts)===h[5],'transaction or receipt root mismatch');

  let gas=0n,bloom=0n,selected;
  for(let i=0;i<receipts.length;i++){
    const tx=Transaction.from(transactions[i]);
    requireMatch([0,1,2].includes(tx.type)&&tx.isSigned()&&tx.serialized===transactions[i].toLowerCase()&&
      (tx.chainId===1337n||(tx.type===0&&tx.chainId===0n))&&tx.from,'invalid block transaction');
    const rc=receiptForType(receipts[i],tx.type);
    const current=BigInt(rc[1]),receiptBloom=computedBloom(rc[3]);
    requireMatch(current>gas&&current-gas<=tx.gasLimit&&receiptBloom===BigInt(rc[2]),'receipt cumulative gas or logs bloom');
    gas=current;bloom|=receiptBloom;
    if(i===index)selected=rc;
  }
  requireMatch(gas===BigInt(h[10])&&gas<=BigInt(h[9])&&bloom===BigInt(h[6]),'block gas or bloom');
  return {txBytes:transactions[index],rc:selected,position:{transactionIndex:index,transactionCount:transactions.length}};
}

export function verifyPostCapsule(capsule,expectedBlockHash,expectedTxHash){
  requireMatch(isHexString(expectedBlockHash,32)&&isHexString(expectedTxHash,32),'supply both expected hashes');
  const keys=capsule&&Object.keys(capsule).sort().join(',');
  const mixed=keys==='header,receipts,transactions';
  requireMatch(mixed||keys==='header,receipt,txBytes','unexpected archive fields');
  boundedHex(capsule.header);
  const blockHash=keccak256(capsule.header),hash=expectedTxHash.toLowerCase();
  requireMatch(blockHash===expectedBlockHash.toLowerCase(),'block hash mismatch');
  const h=readHeader(capsule.header.toLowerCase());
  let txBytes,rc,position;
  if(mixed){
    ({txBytes,rc,position}=readMixed(capsule,h,hash));
  }else{
    txBytes=capsule.txBytes;
    boundedHex(txBytes);boundedHex(capsule.receipt);
    requireMatch(singletonRoot(txBytes)===h[4]&&singletonRoot(capsule.receipt)===h[5],'transaction or receipt root mismatch');
  }
  const tx=Transaction.from(txBytes);
  requireMatch(tx.serialized===txBytes.toLowerCase()&&tx.isSigned()&&tx.hash===hash&&tx.chainId===1337n&&
    [0,1,2].includes(tx.type)&&tx.to===posts&&tx.value===0n,'unexpected signed transaction');
  const author=tx.from;
  const [name,body]=pool.decodeFunctionData('publish',tx.data);
  requireMatch(tx.data===pool.encodeFunctionData('publish',[name,body])&&/^[a-z0-9]+$/.test(name)&&
    body.length>0&&Array.from(body).length<=420,'invalid publication calldata');
  if(!mixed){
    rc=receiptForType(capsule.receipt,tx.type);
    requireMatch(rc[1]===h[10]&&rc[2]===h[6],'receipt gas or bloom');
  }
  requireMatch(rc[0]==='0x01','selected post reverted');
  const credits=readCredits(rc[3],author,name,body);
  return {hash,blockHash,name,body,author,fee:formatEther(fee),credits,...position};
}
