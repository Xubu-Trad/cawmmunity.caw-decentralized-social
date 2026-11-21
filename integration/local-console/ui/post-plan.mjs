import {keccak256Hex} from './keccak256.mjs';
const address=/^0x[0-9a-fA-F]{40}$/,hash=/^0x[0-9a-fA-F]{64}$/,quantity=/^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/;
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
const uint=x=>typeof x==='string'&&/^(?:0|[1-9][0-9]{0,77})$/.test(x)&&BigInt(x)<2n**256n;
const word=x=>BigInt(x).toString(16).padStart(64,'0');
const hex=bytes=>'0x'+Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
const literal=text=>keccak256Hex(hex(new TextEncoder().encode(text)));
export const POST_PROFILE=literal('LOCAL_REGISTRY_POST_V1');
export const POST_EVENT_TOPIC=literal('LocalPostPublished(uint256,uint256,uint256,address,bytes32,bytes)');
const PUBLISH_SELECTOR=literal('publish(uint256,uint256,uint256,bytes)').slice(2,10);

// Exact Unicode scalars; no trimming, replacement, case folding or normalization.
export function postText(text){
 if(typeof text!=='string'||text.length===0||text.length>840)throw Error('Post requires 1 to 420 Unicode scalars.');
 let scalars=0;
 for(const char of text){const cp=char.codePointAt(0);if(cp>=0xd800&&cp<=0xdfff)throw Error('Post contains an unpaired surrogate.');if(++scalars>420)throw Error('Post exceeds 420 Unicode scalars.');}
 const encoded=new TextEncoder().encode(text);
 if(encoded.length>1680)throw Error('Post exceeds 1680 UTF-8 bytes.');
 const bytesHex=hex(encoded);
 return {bytesHex,textHash:keccak256Hex(bytesHex),scalars,byteLength:encoded.length};
}

export function postData(posting,epoch,postNonce,text,ownerType='fixture-wallet'){
 if(!address.test(posting)||!uint(epoch)||!uint(postNonce))throw Error('Invalid posting selection.');
 const {bytesHex,byteLength}=postText(text);
 const inner=PUBLISH_SELECTOR+word(2)+word(epoch)+word(postNonce)+word(128)+word(byteLength)+bytesHex.slice(2).padEnd(Math.ceil(byteLength/32)*64,'0');
 if(ownerType==='eoa')return '0x'+inner;
 if(ownerType!=='fixture-wallet')throw Error('Unsupported post owner.');
 return '0x1cff79cd'+posting.slice(2).toLowerCase().padStart(64,'0')+word(64)+word(inner.length/2)+inner.padEnd(Math.ceil(inner.length/64)*64,'0');
}

export function verifyPostPlan(plan,state,account,text){
 const type=state?.ownerType??'fixture-wallet',signer=state?.signer??state?.controller,owner=state?.owner,contracts=state?.contracts;
 const supported=type==='fixture-wallet'?same(owner,contracts?.wallet)&&same(signer,state?.controller):type==='eoa'&&same(owner,signer)&&address.test(owner)&&BigInt(owner)>0xffffn&&!Object.values(contracts??{}).some(a=>same(a,owner));
 const encoded=postText(text);
 if(!plan||!state||!supported||!address.test(account)||!same(account,signer)||!address.test(contracts?.posting)||
    plan.action!=='post'||Object.hasOwn(plan,'amount')||Object.hasOwn(plan,'recipient')||plan.chainId!=='0x7a69'||state.chainId!==plan.chainId||!same(plan.from,account)||
    !same(plan.owner,owner)||!same(plan.posting,contracts.posting)||!same(plan.to,type==='fixture-wallet'?contracts.wallet:contracts.posting)||plan.value!=='0x0'||
    !uint(plan.epoch)||plan.epoch!==state.epoch||!uint(plan.postNonce)||plan.postNonce!==state.posting?.nonce||
    !same(plan.profile,POST_PROFILE)||!same(state.posting?.profile,POST_PROFILE)||plan.text!==text||!same(plan.textHash,encoded.textHash)||
    !hash.test(plan.genesisHash)||!same(plan.genesisHash,state.genesisHash)||!hash.test(plan.blockHash)||!quantity.test(plan.blockNumber)||
    !same(plan.data,postData(contracts.posting,plan.epoch,plan.postNonce,text,type)))throw Error('Post bytes do not match the reviewed account, text and posting contract. Refresh and try again.');
 return true;
}
