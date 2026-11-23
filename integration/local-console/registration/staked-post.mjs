import {BrowserProvider,Contract,Interface,parseEther} from '/ethers.mjs';
const $=id=>document.getElementById(id);
const cfg=await (await fetch('/config')).json(),wallet=window.ethereum,fee=parseEther('5000');
const registryAbi=['function lookup(string) view returns(uint256,address)'];
const tokenAbi=['function balanceOf(address) view returns(uint256)','function allowance(address,address) view returns(uint256)','function approve(address,uint256) returns(bool)'];
const postAbi=['function publish(string,string)'];
let reviewed,revision=0,busy=false;
function controls(){
  $('review').disabled=busy;$('approve').disabled=busy||!reviewed||reviewed.allowed;
  $('publish').disabled=busy||!reviewed?.allowed;
}
function invalidate(){revision++;reviewed=null;$('status').textContent='';controls();}
for(const key of ['name','body'])$(key).addEventListener('input',invalidate);
wallet?.on?.('chainChanged',invalidate);wallet?.on?.('accountsChanged',invalidate);
async function context(){
  if(!wallet)throw Error('Enable a wallet to publish. Reading needs no wallet.');
  if(await wallet.request({method:'eth_chainId'})!=='0x539'||(await wallet.request({method:'eth_getBlockByNumber',params:['0x0',false]}))?.hash!==cfg.genesis)throw Error('Select your disposable chain at '+cfg.endpoint);
  const [account]=await wallet.request({method:'eth_accounts'});if(!account)throw Error('Connect your local account.');
  return account.toLowerCase();
}
async function inspect(){
  const name=$('name').value,body=$('body').value;
  if(!/^[a-z0-9]+$/.test(name)||!body||Array.from(body).length>420)throw Error('Enter your registered name and 1–420 characters.');
  const account=await context(),p=new BrowserProvider(wallet);
  const registry=new Contract(cfg.registry,registryAbi,p),token=new Contract(cfg.token,tokenAbi,p);
  const [,owner]=await registry.lookup(name);
  if(owner.toLowerCase()!==account)throw Error('This wallet does not own that username NFT.');
  if(await token.balanceOf(account)<fee)throw Error('Get test funds from the registration page.');
  const pool=new Contract(cfg.posts,['function totalStake() view returns(uint256)','function stakeOf(address) view returns(uint256)'],p);
  if(await pool.totalStake()<=await pool.stakeOf(account))throw Error('Another wallet must stake before you can publish.');
  return {account,name,body,allowed:await token.allowance(account,cfg.posts)>=fee};
}
function button(key,fn){$(key).onclick=async()=>{if(busy)return;busy=true;controls();try{await fn();}catch(e){reviewed=null;$('status').textContent=e.shortMessage||e.message;}finally{busy=false;controls();}};}
button('review',async()=>{
  if(!wallet)throw Error('Enable a wallet to publish.');
  await wallet.request({method:'eth_requestAccounts'});
  const n=revision;const r=await inspect();if(n!==revision)return;reviewed=r;
  $('status').textContent='NFT owner confirmed: '+r.account+' · '+r.name+' · 5,000 fixture CAW to '+cfg.posts;
});
async function send(approve){
  const old=reviewed,n=revision,r=await inspect();
  if(n!==revision||old?.body!==r.body||old.name!==r.name||old.account!==r.account||(!approve&&!r.allowed))throw Error('Review again.');
  const data=approve?new Interface(tokenAbi).encodeFunctionData('approve',[cfg.posts,fee]):new Interface(postAbi).encodeFunctionData('publish',[r.name,r.body]);
  if(await context()!==r.account||n!==revision)throw Error('Review again.');
  const hash=await wallet.request({method:'eth_sendTransaction',params:[{from:r.account,to:approve?cfg.token:cfg.posts,data,chainId:'0x539'}]});
  if(!approve){$('hash').value=hash;location.hash=hash;}
  $('status').textContent='Submitted '+hash;
  const receipt=await new BrowserProvider(wallet).waitForTransaction(hash,1,45000);
  if(receipt?.status!==1)throw Error('Pending or unsuccessful: '+hash);
  if(approve){const refreshed=await inspect();if(n===revision){reviewed=refreshed;$('status').textContent='Approval mined. Ready to publish.';}}
  else{reviewed=null;$('status').textContent='Post mined.';await readPost();}
}
async function stakeAction(kind){
  reviewed=null;
  if(!wallet)throw Error('Enable your local wallet.');
  await wallet.request({method:'eth_requestAccounts'});
  const account=await context();
  const amount=kind==='unstake'?0n:parseEther($('amount').value);
  if(kind!=='unstake'&&amount<=0n)throw Error('Enter a positive stake.');
  const approval=kind==='approveStake';
  const data=approval?new Interface(tokenAbi).encodeFunctionData('approve',[cfg.posts,amount]):
    new Interface(['function stake(uint256)','function unstake()']).encodeFunctionData(kind,kind==='stake'?[amount]:[]);
  const h=await wallet.request({method:'eth_sendTransaction',params:[{from:account,to:approval?cfg.token:cfg.posts,data,chainId:'0x539'}]});
  $('status').textContent='Submitted '+h;
  const rc=await new BrowserProvider(wallet).waitForTransaction(h,1,45000);
  if(rc?.status!==1)throw Error('Check transaction '+h);
  $('status').textContent='Mined '+kind+' · '+h;
}
for(const id of ['approveStake','stake','unstake'])button(id,()=>stakeAction(id));
button('approve',()=>send(true));button('publish',()=>send(false));
let reading=0;
async function readPost(){
  const turn=++reading,h=$('hash').value.trim();$('credits').textContent='';$('content').textContent='';$('link').hidden=true;$('likePost').hidden=true;$('recawPost').hidden=true;
  try{
    if(!/^0x[0-9a-fA-F]{64}$/.test(h))throw Error('Enter a transaction hash.');
    const res=await fetch('/post/'+h);if(!res.ok)throw Error(await res.text());const p=await res.json();if(turn!==reading)return;
    $('result').textContent=p.name+' · NFT owner at publication '+p.author+' · '+p.fee+' paid · block '+p.block+' ('+p.blockHash+')';
    $('credits').textContent=p.credits.map(c=>c.staker+' · stake '+c.weight+' · received '+c.amount+' fixture CAW').join('\n');
    $('content').textContent=p.body;$('link').href='#'+p.hash;$('link').hidden=false;$('likePost').href='http://127.0.0.1:34739/?post='+p.hash;$('likePost').hidden=false;$('recawPost').href='http://127.0.0.1:34740/?post='+p.hash;$('recawPost').hidden=false;
  }catch(e){if(turn===reading)$('result').textContent=e.message;}
}
$('read').onclick=readPost;$('hash').oninput=()=>{reading++;$('credits').textContent='';$('content').textContent='';$('result').textContent='';$('link').hidden=true;$('likePost').hidden=true;$('recawPost').hidden=true;};
function route(){if(/^#0x[0-9a-f]{64}$/i.test(location.hash)){$('hash').value=location.hash.slice(1);readPost();}}
window.addEventListener('hashchange',route);route();
