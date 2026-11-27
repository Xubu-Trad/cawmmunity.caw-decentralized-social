import {completeFeedLogs} from './complete-feed-logs.mjs';
import {readFileSync} from 'node:fs';
import {Interface,id,toQuantity} from 'ethers';
import {capturePostCapsule} from './post-capsule.mjs';
import {readHeader,verifyPostCapsule} from './verify-post-capsule.mjs';
import {verifyRuntime} from './verify-runtime.mjs';

const {contracts}=JSON.parse(readFileSync(new URL('./disposable-runtime.json',import.meta.url)));
const follow=new Interface(['event Followed(string name,string target,address indexed payer,address indexed recipient,uint256 eligible)',
  'function following(bytes32,bytes32) view returns(bool)']);
const posts=new Interface(['event Published(uint256 indexed tokenId,address indexed author,string name,string body,uint256 fee)']);

export async function discoverFollowing(rpc,name){
  if(!/^[a-z0-9]+$/.test(name))throw Error('Enter a registered username.');
  const head=await rpc('eth_getBlockByNumber',['latest',false]);
  const runtime=await verifyRuntime(rpc,head.hash,name);
  if(runtime.block!==head.number)throw Error('Selected head height disagrees with the checked block.');
  const at={blockHash:head.hash,requireCanonical:true};
  const targets=new Set();
  for await(const log of completeFeedLogs(rpc,head,contracts.follow.address,follow.getEvent('Followed').topicHash,'Follow')){
    const args=follow.parseLog(log).args;
    if(args.name!==name || targets.has(args.target))continue;
    const data=follow.encodeFunctionData('following',[id(name),id(args.target)]);
    const result=await rpc('eth_call',[{to:contracts.follow.address,data},at]);
    if(!follow.decodeFunctionResult('following',result)[0])throw Error('Follow event disagrees with checkpoint state.');
    targets.add(args.target);
  }
  const items=[],seen=new Set();
  if(targets.size){
    for await(const log of completeFeedLogs(rpc,head,contracts.posts.address,posts.getEvent('Published').topicHash,'Publication')){
      const args=posts.parseLog(log).args;
      if(!targets.has(args.name))continue;
      if(seen.has(log.transactionHash))throw Error('Duplicate post in node discovery.');
      if(items.length===32)throw Error('More than 32 matching posts. This feed cannot be shown completely.');
      const archive=await capturePostCapsule(rpc,log.blockHash,log.transactionHash);
      const post=verifyPostCapsule(archive,log.blockHash,log.transactionHash);
      if(post.name!==args.name || post.body!==args.body)throw Error('Discovered post disagrees with signed receipt.');
      const number=readHeader(archive.header)[8];
      const height=number==='0x'?0n:BigInt(number);
      if(log.blockNumber!==toQuantity(height))throw Error('Publication height disagrees with the verified post header.');
      items.push({post,height:Number(height),index:post.transactionIndex??0});
      seen.add(post.hash);
    }
  }
  const finalHead=await rpc('eth_getBlockByNumber',['latest',false]);
  if(finalHead?.hash!==head.hash || finalHead.number!==head.number)throw Error('Head changed during recheck. Retrying.');
  items.sort((a,b)=>b.height-a.height||b.index-a.index);
  return {name,head:head.hash,height:head.number,targets:[...targets],items};
}
