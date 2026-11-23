import {Contract,Interface,ZeroAddress,ZeroHash,formatEther,getAddress,id,keccak256,parseEther} from '/ethers.mjs';

const proofType='(uint256 height,bytes header,bytes txBytes,bytes receipt)';
const actions={
  post:['posts','publish(string,string)',5000,'stakers receive 5,000'],
  like:['likes','like(string,bytes32,address[],'+proofType+')',2000,'author receives 1,600 and stakers share 400'],
  recaw:['recaw','recaw(string,bytes32,address[],'+proofType+')',4000,'author receives 2,000 and stakers share 2,000'],
  follow:['follow','follow(string,string,address,address[])',30000,'followed account receives 24,000 and stakers share 6,000'],
  deposit:['vault','deposit(uint256,uint256,uint256)',0,'credit this NFT account'],
  withdraw:['vault','withdraw(uint256,uint256,uint256)',0,'pay the current NFT owner']
};
const tokenAbi=['function allowance(address,address) view returns(uint256)','function approve(address,uint256)'];
export async function prepareAction(cfg,provider,account,kind,name,input){
  const [role,signature,fee,terms]=actions[kind];
  const to=getAddress(cfg.actions[role]);
  const registry=new Contract(cfg.registry,['function authority(uint256) view returns(address,uint256)'],provider);
  const [owner,epoch]=await registry.authority(id(name));
  if(owner!==account)throw Error('Selected account does not own this username.');
  let args,amount=parseEther(String(fee)),recipient='';
  if(kind==='deposit'||kind==='withdraw'){
    amount=parseEther(input);
    if(amount<=0n)throw Error('Enter a positive CAW amount.');
    args=[id(name),epoch,amount];recipient=account;
  }else if(kind==='post'){
    if(!input||Array.from(input).length>420)throw Error('Enter 1–420 characters.');
    args=[name,input];
  }else{
    const block=await provider.send('eth_blockNumber',[]);
    const count=Number(BigInt(await provider.getStorage(cfg.actions.posts,0,block)));
    if(count>32)throw Error('Stake member count exceeds the contract limit.');
    const start=BigInt(keccak256(ZeroHash)),members=[];
    for(let i=0;i<count;i++){
      const member=getAddress('0x'+(await provider.getStorage(cfg.actions.posts,start+BigInt(i),block)).slice(-40));
      if(member!==account)members.push(member);
    }
    members.sort((a,b)=>BigInt(a)<BigInt(b)?-1:1);
    if(kind==='follow'){
      [recipient]=await registry.authority(id(input));args=[name,input,recipient,members];
    }else{
      if(!/^0x[0-9a-fA-F]{64}$/.test(input))throw Error('Enter a post transaction hash.');
      const rc=await provider.getTransactionReceipt(input);
      if(rc?.status!==1||rc.to!==getAddress(cfg.actions.posts))throw Error('Post is outside this deployment.');
      const published=new Interface(['event Published(uint256 indexed tokenId,address indexed author,string name,string body,uint256 fee)']);
      const event=rc.logs.filter(l=>l.address===rc.to).map(l=>published.parseLog(l)).find(e=>e?.name==='Published');
      if(!event)throw Error('Published event missing.');
      recipient=event.args.author;
      const likes=new Contract(cfg.actions.likes,['function authorOf(bytes32) view returns(address)'],provider);
      let proof=[0,'0x','0x','0x'];
      if(await likes.authorOf(input)===ZeroAddress){
        const response=await fetch('/proof/'+input);
        if(!response.ok)throw Error(await response.text());
        proof=await response.json();
      }
      args=[name,input,members,proof];
    }
    if(account===recipient)throw Error('Choose another account.');
  }
  const method=signature.split('(')[0],iface=new Interface(['function '+signature]);
  const data=iface.encodeFunctionData(method,args);
  const token=new Contract(cfg.token,tokenAbi,provider);
  const needsApproval=kind!=='withdraw' && await token.allowance(account,to)<amount;
  const tx=needsApproval?{to:cfg.token,data:token.interface.encodeFunctionData('approve',[to,amount])}:{to,data};
  await provider.call({...tx,from:account});
  return {tx,data,epoch:String(epoch),needsApproval,summary:[kind,name,formatEther(amount)+' CAW',terms,recipient,'signer '+account,'contract '+to].filter(Boolean).join(' · ')};
}
