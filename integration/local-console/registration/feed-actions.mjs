import {BrowserProvider,Contract,Interface,id,parseEther} from '/ethers.mjs';

const rates={
  like:{label:'Like',fee:'2000',author:'1,600',pool:'400',reader:34739,used:'liked'},
  recaw:{label:'reCAW',fee:'4000',author:'2,000',pool:'2,000',reader:34740,used:'reposted'}
};
const tokenAbi=['function balanceOf(address) view returns(uint256)','function allowance(address,address) view returns(uint256)','function approve(address,uint256)'];
async function json(path){
  const res=await fetch(path);if(!res.ok)throw Error(await res.text());return res.json();
}
function node(parent,tag,text){
  const el=document.createElement(tag);el.textContent=text;parent.append(el);return el;
}
export function renderActions(card,name,item){
  const wallet=window.ethereum, source=item.originalHash;
  const controls=node(card,'div',''),panel=node(card,'div','');
  let generation=0,locked=false;
  const live=n=>card.isConnected && n===generation;
  for(const [kind,rate] of Object.entries(rates)){
    const existing=item.actions[kind];
    if(existing){node(controls,'a','Open '+rate.label+' receipt').href=existing;controls.append(' ');continue;}
    const choose=node(controls,'button',rate.label);
    choose.onclick=async()=>{
      if(locked)return;
      const n=++generation;panel.replaceChildren();
      node(panel,'p',name+' · '+rate.label+' original post by '+item.originalName+' · '+Number(rate.fee).toLocaleString('en-US')+' fixture CAW. Author receives '+rate.author+'; eligible stakers share '+rate.pool+'. Local gas is separate.');
      const status=node(panel,'p','');status.setAttribute('role','status');
      const approve=node(panel,'button','Approve '+Number(rate.fee).toLocaleString('en-US'));
      const send=node(panel,'button','Confirm '+rate.label);approve.disabled=send.disabled=true;
      let reviewed;
      async function inspect(){
        if(!wallet)throw Error('Enable your local wallet to sign.');
        const cfg=await json('/action/'+kind+'/config');
        if(await wallet.request({method:'eth_chainId'})!=='0x539'||(await wallet.request({method:'eth_getBlockByNumber',params:['0x0',false]}))?.hash!==cfg.genesis)throw Error('Select the disposable chain.');
        const [account]=await wallet.request({method:'eth_accounts'});
        if(!account)throw Error('Connect the wallet that owns '+name+'.');
        const provider=new BrowserProvider(wallet),registry=new Contract(cfg.registry,['function lookup(string) view returns(uint256,address)'],provider);
        if((await registry.lookup(name))[1].toLowerCase()!==account.toLowerCase())throw Error('Your wallet does not own '+name+'.');
        const target=await json('/action/'+kind+'/target/'+source);
        if(target.post.hash!==source||target.post.name!==item.originalName||target.post.body!==item.body)throw Error('Original post changed. Refresh the feed.');
        if(target.post.author.toLowerCase()===account.toLowerCase())throw Error('Choose another author’s post.');
        if(await new Contract(cfg.likes,cfg.abi,provider)[rate.used](source,id(name)))throw Error('Already submitted. Refresh the feed for the receipt.');
        const token=new Contract(cfg.token,tokenAbi,provider),fee=parseEther(rate.fee);
        const members=target.members.filter(a=>a.toLowerCase()!==account.toLowerCase());
        if(!members.length||await token.balanceOf(account)<fee)throw Error('Eligible stake and sufficient test funds are required.');
        return {account,cfg,provider,fee,target,members,approved:(await token.allowance(account,cfg.likes))>=fee};
      }
      async function submit(isApproval){
        if(locked||!live(n))return;
        locked=true;approve.disabled=send.disabled=true;
        try{
          const r=await inspect();
          if(!live(n)||reviewed.account!==r.account||reviewed.cfg.likes!==r.cfg.likes||reviewed.target.post.author!==r.target.post.author||(!isApproval&&!r.approved))throw Error('Review the action again.');
          const data=isApproval?new Interface(tokenAbi).encodeFunctionData('approve',[r.cfg.likes,r.fee]):new Interface(r.cfg.abi).encodeFunctionData(kind,[name,source,r.members,r.target.proof]);
          const hash=await wallet.request({method:'eth_sendTransaction',params:[{from:r.account,to:isApproval?r.cfg.token:r.cfg.likes,data,chainId:'0x539'}]});
          status.textContent='Submitted '+hash;
          const rc=await r.provider.waitForTransaction(hash,1,60000);
          if(rc?.status!==1)throw Error('Pending or unsuccessful: '+hash);
          if(isApproval){
            const fresh=await inspect();
            if(live(n)&&fresh.account===r.account&&fresh.approved){send.disabled=false;status.textContent='Approval mined. Confirm the action above.';}
          }else{
            const verified=await json('/action/'+kind+'/'+kind+'/'+hash);
            if(verified.hash!==hash||verified.postHash!==source||verified.payer.toLowerCase()!==r.account.toLowerCase()||verified.name!==name)throw Error('Receipt mismatch.');
            status.textContent='Mined in block '+verified.block+'. ';
            node(status,'a','Open '+rate.label+' receipt').href='http://127.0.0.1:'+rate.reader+'/#'+hash;
            choose.disabled=true;
          }
        }catch(e){status.textContent=e.shortMessage||e.message;}finally{locked=false;}
      }
      approve.onclick=()=>submit(true);send.onclick=()=>submit(false);
      try{
        if(!wallet)throw Error('Enable your local wallet to sign.');
        await wallet.request({method:'eth_requestAccounts'});
        reviewed=await inspect();if(!live(n))return;
        status.textContent='Verified owner of '+name+'. Author wallet '+reviewed.target.post.author;
        approve.disabled=reviewed.approved;send.disabled=!reviewed.approved;
      }catch(e){if(live(n))status.textContent=e.shortMessage||e.message;}
    };
  }
}
