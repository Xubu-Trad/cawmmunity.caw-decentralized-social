// Bounded semantic model of the PR19 synthetic candidate, not an EVM interpreter.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {keccak256Hex} from '../../reference/keccak256.mjs';
import {inspectDigestSignature} from '../../reference/ethereum-block-senders.mjs';
const W=n=>Buffer.from(BigInt(n).toString(16).padStart(64,'0'),'hex');
const H=b=>createHash('sha256').update(b).digest();
const K=b=>keccak256Hex('0x'+Buffer.from(b).toString('hex'));
const word=(b,i)=>{assert(b.length>=(i+1)*32,'ABI_LENGTH');return BigInt('0x'+b.subarray(i*32,(i+1)*32).toString('hex'));};
const addr=n=>{assert(n>=0n&&n<2n**160n,'ADDRESS');return '0x'+n.toString(16).padStart(40,'0');};
const selector=s=>K(Buffer.from(s)).slice(0,10);
const NS=Buffer.alloc(32,0x11),F=5000n*10n**18n;
const serial=x=>JSON.parse(JSON.stringify(x,(_,v)=>typeof v==='bigint'?v.toString():v));
const branch=(l,r)=>({hash:H(Buffer.concat([Buffer.from([2]),l.hash,W(l.sum),r.hash,W(r.sum)])),sum:l.sum+r.sum});
export function stakeRoot(stakes){
 let empty={hash:H(Buffer.from([0])),sum:0n};let level=new Map(stakes.map((s,i)=>[BigInt(i+1),{hash:H(Buffer.concat([Buffer.from([1]),W(i+1),W(s)])),sum:s}]));
 for(let h=0;h<256;h++){const next=new Map();for(const i of level.keys()){const p=i>>1n;if(!next.has(p))next.set(p,branch(level.get(p*2n)??empty,level.get(p*2n+1n)??empty));}level=next;empty=branch(empty,empty);}
 const n=level.get(0n);return '0x'+H(Buffer.concat([Buffer.from('CAW_STAKE_TREE_RESEARCH_V1\0'),NS,n.hash,W(n.sum)])).toString('hex');
}
function proofRoot(id,amount,b){let n={hash:H(Buffer.concat([Buffer.from([1]),W(id),W(amount)])),sum:amount};
 for(let i=0;i<256;i++){const sibling={hash:b.subarray(160+i*64,192+i*64),sum:word(b,6+i*2)};n=(id&1n)?branch(sibling,n):branch(n,sibling);id>>=1n;}
 return {root:'0x'+H(Buffer.concat([Buffer.from('CAW_STAKE_TREE_RESEARCH_V1\0'),NS,n.hash,W(n.sum)])).toString('hex'),sum:n.sum};}
function creationAddress(from,nonce){assert(nonce>=0n&&nonce<128n,'CREATE_NONCE_SCOPE');const n=nonce===0n?Buffer.from([128]):Buffer.from([Number(nonce)]);return '0x'+K(Buffer.concat([Buffer.from([214,148]),Buffer.from(from.slice(2),'hex'),n])).slice(-40);}
function tail(b,offset){assert(offset%32===0&&offset>=288&&offset+32<=b.length,'ABI_OFFSET');const length=Number(word(b,offset/32));assert(Number.isSafeInteger(length)&&length<=1680,'ABI_BYTES');const end=offset+32+Math.ceil(length/32)*32;assert(end<=b.length,'ABI_END');assert(b.subarray(offset+32+length,end).every(x=>x===0),'ABI_PADDING');return {bytes:b.subarray(offset+32,offset+32+length),end};}
export function reconstruct(history,contracts,timestamps){
 assert.equal(history.length,26,'BOUNDED_HISTORY');
 const tokenCode='0x'+contracts.MockTokenResearch.evm.bytecode.object;
 const vaultCode='0x'+contracts.DeployedCustodyStakeResearch.evm.bytecode.object;
 const s={owners:[],epochs:[0n,0n,0n],credits:[0n,0n,0n],stakes:[0n,0n,0n],liabilities:0n,dust:0n,nonce:0n,wallets:{},allowances:{},minted:0n};
 let token,vault,root;const steps=[];let skipped=0,previous=0n;
 const balance=a=>s.wallets[a]??0n;
 function add(a,n){s.wallets[a]=balance(a)+n;assert(s.wallets[a]>=0n,'TOKEN_BALANCE');}
 function invariants(){if(!vault)return;assert.equal(s.liabilities,s.credits.reduce((a,b)=>a+b,0n),'CREDIT_SUM');assert.equal(balance(vault),s.liabilities+s.dust,'BACKING');assert.equal(Object.values(s.wallets).reduce((a,b)=>a+b,0n),s.minted,'TOKEN_CONSERVATION');s.stakes.forEach((v,i)=>assert(v>=0n&&v<=s.credits[i],'STAKE_BACKING'));}
 for(const row of history){
  const t=row.transaction,r=row.receipt;const number=BigInt(row.blockNumber);assert.equal(number,previous+1n,'ORDER');previous=number;
  assert.equal(t.hash,row.association.transactionHash,'ASSOCIATION');assert.equal(t.value,'0x0','NATIVE_VALUE_SCOPE');
  const before=JSON.stringify(serial(s));let action;
  if(r.status==='0x0'){assert.equal(r.logs.length,0,'FAILED_LOGS');skipped++;action='reverted; no token/account effect';assert.equal(JSON.stringify(serial(s)),before);}
  else {
   assert.equal(r.status,'0x1');const raw=Buffer.from(t.data.slice(2),'hex'),sig=t.data.slice(0,10),b=raw.subarray(4);
   if(t.to==='0x'){
    const created=creationAddress(t.from,BigInt(t.nonce));
    if(t.data===tokenCode){assert(!token,'DUPLICATE_TOKEN');token=created;action='deploy mock token';}
    else{assert(!vault&&token,'DEPLOY_ORDER');assert(t.data.startsWith(vaultCode),'CREATION_CODE');const args=Buffer.from(t.data.slice(vaultCode.length),'hex');assert.equal(args.length,128);assert.equal(addr(word(args,0)),token);s.owners=[1,2,3].map(i=>addr(word(args,i)));assert(s.owners.every(a=>BigInt(a)!==0n));vault=created;root=stakeRoot(s.stakes);action='deploy custody candidate';}
    assert.equal(r.logs.length,0);
   }else if(t.to===token){
    assert.equal(b.length,64);const to=addr(word(b,0)),amount=word(b,1);
    if(sig===selector('mint(address,uint256)')){add(to,amount);s.minted+=amount;action='mock mint';}
    else {assert.equal(sig,selector('approve(address,uint256)'),'TOKEN_METHOD');s.allowances[t.from+':'+to]=amount;action='approve';}
    assert.equal(r.logs.length,0);
   }else{
    assert.equal(t.to,vault,'TARGET');
    if(sig===selector('settleFixedPool1((uint256,uint256,uint256,uint256,uint256,bytes32,bytes32),bytes,bytes)')){
     const q=Array.from({length:7},(_,i)=>word(b,i));assert.equal(q[0],1n);assert.equal(q[1],s.epochs[0],'POST_EPOCH');assert.equal(q[2],s.nonce,'POST_NONCE');assert.equal(q[5],BigInt(root),'POST_ROOT');
     const time=BigInt(timestamps[row.blockHash]);assert(q[3]<q[4]&&q[3]<=time&&time<q[4],'WINDOW');assert.equal(word(b,7),288n);const signature=tail(b,288);assert.equal(signature.bytes.length,65);assert.equal(word(b,8),BigInt(signature.end));const text=tail(b,signature.end);assert.equal(text.end,b.length);assert.equal(K(text.bytes),'0x'+W(q[6]).toString('hex'),'TEXT_HASH');
     const decoded=new TextDecoder('utf-8',{fatal:true}).decode(text.bytes);assert([...decoded].length>=1&&[...decoded].length<=420,'TEXT_LENGTH');
     const domain=K(Buffer.concat([Buffer.from(K(Buffer.from('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')).slice(2),'hex'),Buffer.from(K(Buffer.from('CAW C007 Synthetic Action')).slice(2),'hex'),Buffer.from(K(Buffer.from('1')).slice(2),'hex'),W(31337),W(BigInt(vault))]));
     const type=K(Buffer.from('Post(uint256 accountId,uint256 epoch,uint256 nonce,uint256 validAfter,uint256 deadline,bytes32 stakeRoot,bytes32 textHash,uint256 fee,bytes32 profile)'));
     const body=K(Buffer.concat([Buffer.from(type.slice(2),'hex'),...q.map(W),W(F),Buffer.from(K(Buffer.from('CAW_C007_SYNTHETIC_POST_V1')).slice(2),'hex')]));
     const digest=K(Buffer.concat([Buffer.from('1901','hex'),Buffer.from(domain.slice(2),'hex'),Buffer.from(body.slice(2),'hex')]));
     assert.equal(inspectDigestSignature(digest,'0x'+signature.bytes.toString('hex')).from,s.owners[0],'POST_SIGNER');
     assert(s.credits[0]-s.stakes[0]>=F,'FEE_CREDIT');const eligible=s.stakes[1]+s.stakes[2];assert(eligible>0n);const a=F*s.stakes[1]/eligible,c=F*s.stakes[2]/eligible,d=F-a-c;
     assert.equal(r.logs.length,2);assert.deepEqual(r.logs[0],{address:vault,topics:[K(Buffer.from('ExperimentalFeeSettled(uint256,uint256,uint256,uint256,uint256,bytes32)')),'0x'+W(1).toString('hex'),'0x'+W(s.nonce).toString('hex')],data:'0x'+Buffer.concat([W(a),W(c),W(d),W(q[6])]).toString('hex')});
     const logText=Buffer.concat([W(32),W(text.bytes.length),text.bytes,Buffer.alloc((32-text.bytes.length%32)%32)]);
     assert.deepEqual(r.logs[1],{address:vault,topics:[K(Buffer.from('ExperimentalTextPublished(uint256,uint256,bytes)')),'0x'+W(1).toString('hex'),'0x'+W(s.nonce).toString('hex')],data:'0x'+logText.toString('hex')});
     s.credits[0]-=F;s.credits[1]+=a;s.credits[2]+=c;s.liabilities-=d;s.dust+=d;s.nonce++;action='signed post fee distribution';
    }else{
     const id=Number(word(b,0));assert(id>=1&&id<=3,'ACCOUNT');const i=id-1;assert.equal(t.from,s.owners[i],'OWNER');assert.equal(word(b,1),s.epochs[i],'EPOCH');assert.equal(r.logs.length,0);
     if(sig===selector('changeStake(uint256,uint256,bool,uint256,bool,(bytes32,uint256)[256])')){
      assert.equal(b.length,160+256*64);const increase=word(b,2),amount=word(b,3);assert(increase===0n||increase===1n);assert.equal(word(b,4),0n);assert(amount>0n);const old=proofRoot(BigInt(id),s.stakes[i],b);assert.equal(old.root,root,'STAKE_PROOF');assert.equal(old.sum,s.stakes.reduce((a,b)=>a+b,0n));s.stakes[i]+=increase?amount:-amount;root=stakeRoot(s.stakes);assert.equal(proofRoot(BigInt(id),s.stakes[i],b).root,root);action='change stake';
     }else{
      assert.equal(b.length,96);const n=word(b,2);
      if(sig===selector('transferAccount(uint256,uint256,address)')){const to=addr(n);assert(n!==0n);s.owners[i]=to;s.epochs[i]++;action='transfer account';}
      else if(sig===selector('deposit(uint256,uint256,uint256)')){assert(n>0n);const key=t.from+':'+vault;assert((s.allowances[key]??0n)>=n,'ALLOWANCE');s.allowances[key]-=n;add(t.from,-n);add(vault,n);s.credits[i]+=n;s.liabilities+=n;action='deposit';}
      else {assert.equal(sig,selector('withdraw(uint256,uint256,uint256)'),'VAULT_METHOD');assert(n>0n&&n<=s.credits[i]-s.stakes[i],'AVAILABLE_CREDIT');s.credits[i]-=n;s.liabilities-=n;add(vault,-n);add(t.from,n);action='withdraw';}
     }
    }
   }
   invariants();
  }
  steps.push({blockNumber:row.blockNumber,transactionHash:t.hash,action,status:r.status,state:serial(s)});
 }
 assert(token&&vault);const final={root:String(BigInt(root)),totalStake:String(s.stakes.reduce((a,b)=>a+b,0n)),liabilities:String(s.liabilities),poolDust:String(s.dust),nonce:String(s.nonce),balance:String(balance(vault))};
 for(let i=0;i<3;i++)Object.assign(final,{['credit'+(i+1)]:String(s.credits[i]),['stake'+(i+1)]:String(s.stakes[i]),['owner'+(i+1)]:String(BigInt(s.owners[i])),['epoch'+(i+1)]:String(s.epochs[i])});
 return {final,token,vault,wallets:serial(s.wallets),allowances:serial(s.allowances),steps,failedTransactionsSkipped:skipped};
}
