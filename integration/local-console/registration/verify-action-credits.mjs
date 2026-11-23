import {parseEther,formatEther,Interface} from 'ethers';
const token=new Interface(['event Transfer(address indexed from,address indexed to,uint256 amount)']);
export function verifyCredits({rc,tokenAddress,payer,recipient,requested,events,eligible,direct,poolShare}){
  const transfers=rc.logs.filter(l=>l.address===tokenAddress&&l.topics[0]===token.getEvent('Transfer').topicHash).map(l=>token.parseLog(l).args);
  function movement(to,amount){
    const t=transfers.shift();
    if(!t||t.from!==payer||t.to!==to||t.amount!==amount)throw Error('Token transfer mismatch');
  }
  movement(recipient,parseEther(direct));
  const credits=[];let weight=0n,paid=0n,previous=0n;
  for(const [i,event] of events.entries()){
    const c=event.args;
    if(event.name!=='Credit'||c.staker!==requested[i]||c.staker===payer||BigInt(c.staker)<=previous||c.weight===0n)throw Error('Invalid stake recipient');
    previous=BigInt(c.staker);weight+=c.weight;
    const next=parseEther(poolShare)*weight/eligible;
    if(c.amount!==next-paid)throw Error('Invalid stake share');
    paid=next;if(c.amount)movement(c.staker,c.amount);
    credits.push({wallet:c.staker,amount:formatEther(c.amount),stake:formatEther(c.weight)});
  }
  if(transfers.length||paid!==parseEther(poolShare)||weight!==eligible)throw Error('Incomplete payout');
  return credits;
}
