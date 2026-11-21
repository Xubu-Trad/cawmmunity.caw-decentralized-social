import {withdrawalData} from './ui/withdrawal-plan.mjs';
import {transferData} from './ui/account-transfer-plan.mjs';
import {postData,postText,POST_PROFILE} from './ui/post-plan.mjs';
export function fixturePlan(s,kind='withdrawal',amount='1'){
 const target=kind==='withdrawal'?s.contracts.custody:kind==='transfer'?s.contracts.registry:s.contracts.posting;
 const p={chainId:s.chainId,genesisHash:s.genesisHash,from:s.signer,to:s.ownerType==='fixture-wallet'?s.contracts.wallet:target,value:'0x0',epoch:s.epoch,blockNumber:s.blockNumber,blockHash:s.blockHash};
 if(kind==='withdrawal')return {...p,amount,data:withdrawalData(s.contracts.custody,s.epoch,amount,s.ownerType)};
 if(kind==='transfer'){const recipient='0x'+'11'.repeat(20);return {...p,action:kind,recipient,owner:s.owner,registry:s.contracts.registry,data:transferData(s.contracts.registry,s.owner,recipient,s.ownerType)};}
 const text='review test';return {...p,action:'post',owner:s.owner,posting:s.contracts.posting,postNonce:s.posting.nonce,text,textHash:postText(text).textHash,profile:POST_PROFILE,data:postData(s.contracts.posting,s.epoch,s.posting.nonce,text,s.ownerType)};
}
