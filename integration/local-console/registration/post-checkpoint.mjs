import {isHexString,keccak256,toQuantity} from 'ethers';
import {encodeHeader} from './single-post-proof.mjs';
import {readHeader,verifyPostCapsule} from './verify-post-capsule.mjs';

const maxHeaders=128;

function checkedPost(capsule,blockHash,txHash,checkpointHash){
  const post=verifyPostCapsule(capsule,blockHash,txHash);
  if(!isHexString(checkpointHash,32))throw Error('Supply a 32-byte checkpoint hash.');
  const fields=readHeader(capsule.header.toLowerCase());
  return {post,postHeight:height(fields),checkpointHash:checkpointHash.toLowerCase()};
}

function height(fields){
  return fields[8]==='0x'?0n:BigInt(fields[8]);
}

function linkedHeader(encoded,expectedHash){
  if(typeof encoded!=='string' || encoded.length>4098 || !isHexString(encoded,true))
    throw Error('Invalid encoded checkpoint header.');
  if(keccak256(encoded)!==expectedHash)throw Error('Checkpoint header hash or parent link mismatch.');
  const fields=readHeader(encoded.toLowerCase());
  return {parent:fields[0],height:height(fields)};
}

function chainDepth(checkpointHeight,postHeight){
  const count=checkpointHeight-postHeight+1n;
  if(count<2n || count>BigInt(maxHeaders))throw Error('Checkpoint must be later than the post and within 128 headers.');
  return Number(count);
}

export function verifyPostCheckpoint(capsule,blockHash,txHash,checkpointHash,evidence){
  const anchor=checkedPost(capsule,blockHash,txHash,checkpointHash);
  if(!evidence || Object.keys(evidence).length!==1 || !Object.hasOwn(evidence,'headers') ||
     !Array.isArray(evidence.headers) || evidence.headers.length<1 || evidence.headers.length>maxHeaders)
    throw Error('Invalid checkpoint evidence.');
  let expectedHash=anchor.checkpointHash,checkpointHeight;
  for(let index=0;index<evidence.headers.length;index++){
    const header=linkedHeader(evidence.headers[index],expectedHash);
    if(index===0){
      checkpointHeight=header.height;
      if(chainDepth(checkpointHeight,anchor.postHeight)!==evidence.headers.length)
        throw Error('Incomplete or extra checkpoint headers.');
    }
    if(header.height!==checkpointHeight-BigInt(index))throw Error('Checkpoint heights are not contiguous.');
    if(index===evidence.headers.length-1){
      return {status:expectedHash===anchor.post.blockHash?'included':'different-block',
        blockHash:anchor.post.blockHash,txHash:anchor.post.hash,checkpointHash:anchor.checkpointHash,
        observedBlockHash:expectedHash,postHeight:toQuantity(anchor.postHeight),
        checkpointHeight:toQuantity(checkpointHeight),headerCount:evidence.headers.length};
    }
    expectedHash=header.parent;
  }
}

export async function capturePostCheckpoint(rpc,capsule,blockHash,txHash,checkpointHash){
  const anchor=checkedPost(capsule,blockHash,txHash,checkpointHash);
  if(await rpc('eth_chainId',[])!=='0x539')throw Error('Expected disposable chain 1337.');
  const headers=[];
  let expectedHash=anchor.checkpointHash,checkpointHeight,count;
  do{
    const block=await rpc('eth_getBlockByHash',[expectedHash,false]);
    if(block?.hash!==expectedHash)throw Error('Requested checkpoint ancestor unavailable.');
    const encoded=encodeHeader(block);
    const header=linkedHeader(encoded,expectedHash);
    if(!headers.length){
      checkpointHeight=header.height;
      count=chainDepth(checkpointHeight,anchor.postHeight);
    }
    if(header.height!==checkpointHeight-BigInt(headers.length) || block.number!==toQuantity(header.height))
      throw Error('Checkpoint ancestor height mismatch.');
    headers.push(encoded);
    expectedHash=header.parent;
  }while(headers.length<count);
  const number=toQuantity(checkpointHeight);
  const canonical=await rpc('eth_getBlockByNumber',[number,false]);
  if(canonical?.hash!==anchor.checkpointHash || canonical.number!==number ||
     encodeHeader(canonical)!==headers[0])throw Error('Selected checkpoint is unavailable or changed.');
  return {headers};
}
