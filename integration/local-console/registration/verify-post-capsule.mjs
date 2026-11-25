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

export function verifyPostCapsule(capsule,expectedBlockHash,expectedTxHash){
  requireMatch(isHexString(expectedBlockHash,32)&&isHexString(expectedTxHash,32),'supply both expected hashes');
  requireMatch(capsule && Object.keys(capsule).sort().join(',')==='header,receipt,txBytes','unexpected archive fields');
  const {header,txBytes,receipt}=capsule;
  for(const bytes of [header,txBytes,receipt]){
    requireMatch(typeof bytes==='string'&&bytes.length<=131074&&isHexString(bytes,true),'invalid or oversized encoded bytes');
  }
  const blockHash=keccak256(header),hash=keccak256(txBytes);
  requireMatch(blockHash===expectedBlockHash.toLowerCase()&&hash===expectedTxHash.toLowerCase(),'block or transaction hash mismatch');
  const h=readHeader(header.toLowerCase());
  requireMatch(singletonRoot(txBytes)===h[4]&&singletonRoot(receipt)===h[5],'transaction or receipt root mismatch');
  const tx=Transaction.from(txBytes);
  requireMatch(tx.serialized===txBytes.toLowerCase()&&tx.isSigned()&&tx.hash===hash&&tx.chainId===1337n&&
    [0,1,2].includes(tx.type)&&tx.to===posts&&tx.value===0n,'unexpected signed transaction');
  const author=tx.from;
  const [name,body]=pool.decodeFunctionData('publish',tx.data);
  requireMatch(tx.data===pool.encodeFunctionData('publish',[name,body])&&/^[a-z0-9]+$/.test(name)&&
    body.length>0&&Array.from(body).length<=420,'invalid publication calldata');
  let encoded=receipt.toLowerCase();
  if(tx.type!==0){
    requireMatch(encoded.startsWith(toBeHex(tx.type,1)),'receipt type mismatch');
    encoded='0x'+encoded.slice(4);
  }
  const rc=canonicalRlp(encoded);
  requireMatch(Array.isArray(rc)&&rc.length===4&&rc[0]==='0x01'&&rc[1]===h[10]&&rc[2]===h[6]&&Array.isArray(rc[3]),'receipt status, gas or bloom');
  const credits=readCredits(rc[3],author,name,body);
  return {hash,blockHash,name,body,author,fee:formatEther(fee),credits};
}
