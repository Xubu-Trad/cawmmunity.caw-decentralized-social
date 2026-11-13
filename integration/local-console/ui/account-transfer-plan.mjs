const address=/^0x[0-9a-fA-F]{40}$/,hash=/^0x[0-9a-fA-F]{64}$/,quantity=/^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/;
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
const word=a=>a.slice(2).toLowerCase().padStart(64,'0');
const number=n=>BigInt(n).toString(16).padStart(64,'0');
// Existing ERC-721 transfer has no expected-epoch argument. The epoch is review
// context, not an on-chain transfer precondition. Account 2 remains a fixture.
export function transferData(registry,owner,recipient,ownerType='fixture-wallet'){
 if(![registry,owner,recipient].every(a=>address.test(a)))throw Error('Invalid account transfer address.');
 const inner='42842e0e'+word(owner)+word(recipient)+number(2);
 if(ownerType==='eoa')return '0x'+inner;
 if(ownerType!=='fixture-wallet')throw Error('Unsupported account owner.');
 return '0x1cff79cd'+word(registry)+number(64)+number(inner.length/2)+inner.padEnd(Math.ceil(inner.length/64)*64,'0');
}
export function verifyTransferPlan(plan,state,account,recipient){
 const type=state?.ownerType??'fixture-wallet',signer=state?.signer??state?.controller;
 const owner=state?.owner,contracts=state?.contracts;
 const supported=type==='fixture-wallet'?same(owner,contracts?.wallet)&&same(signer,state?.controller):type==='eoa'&&same(owner,signer)&&!Object.values(contracts??{}).some(a=>same(a,owner));
 // Empty code is not enough to identify a usable wallet: precompiles can also
 // report 0x. Conservatively exclude the local low-address reserved range.
 if(!plan||!state||!supported||!address.test(account)||/^0x0{40}$/i.test(account)||!same(account,signer)||
    !address.test(recipient)||BigInt(recipient)<=0xffffn||same(recipient,owner)||Object.values(contracts??{}).some(a=>same(a,recipient))||
    plan.action!=='transfer'||Object.hasOwn(plan,'amount')||plan.chainId!=='0x7a69'||!same(plan.from,account)||
    !same(plan.owner,owner)||!same(plan.registry,contracts.registry)||!same(plan.recipient,recipient)||
    !same(plan.to,type==='fixture-wallet'?contracts.wallet:contracts.registry)||plan.value!=='0x0'||
    typeof plan.epoch!=='string'||!/^(?:0|[1-9][0-9]{0,77})$/.test(plan.epoch)||BigInt(plan.epoch)>=2n**256n||plan.epoch!==state.epoch||
    !hash.test(plan.genesisHash)||!same(plan.genesisHash,state.genesisHash)||!hash.test(plan.blockHash)||!quantity.test(plan.blockNumber)||
    !same(plan.data,transferData(contracts.registry,owner,recipient,type)))throw Error('Transfer bytes do not match the reviewed owner, recipient and registry. Refresh and try again.');
 return true;
}
