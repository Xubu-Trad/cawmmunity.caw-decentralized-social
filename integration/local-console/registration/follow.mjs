import {BrowserProvider,Contract,Interface,id,parseEther} from '/ethers.mjs';
const $=key=>document.getElementById(key), wallet=window.ethereum;
async function get(path){const r=await fetch(path);if(!r.ok)throw Error(await r.text());return r.json();}
const cfg=await get('/config'),fee=parseEther('30000'),abi=new Interface(cfg.abi);
const tokenAbi=['function allowance(address,address) view returns(uint256)','function balanceOf(address) view returns(uint256)','function approve(address,uint256)'];
let review=null,busy=false,epoch=0,reading=0;
function controls(){ $('review').disabled=busy;$('approve').disabled=busy||!review||review.allowed;$('send').disabled=busy||!review?.allowed; }
function reset(){epoch++;review=null;$('status').textContent='';controls();}
for(const k of ['target','name'])$(k).oninput=reset;
wallet?.on?.('accountsChanged',reset);wallet?.on?.('chainChanged',reset);
async function inspect(){
  if(!wallet)throw Error('Connect your local wallet to follow a username.');
  if(await wallet.request({method:'eth_chainId'})!=='0x539'||(await wallet.request({method:'eth_getBlockByNumber',params:['0x0',false]})).hash!==cfg.genesis)throw Error('Select the disposable chain.');
  const [account]=await wallet.request({method:'eth_accounts'}),name=$('name').value,target=$('target').value;
  if(!account||![name,target].every(v=>/^[a-z0-9]+$/.test(v)))throw Error('Enter both registered usernames.');
  const p=new BrowserProvider(wallet),reg=new Contract(cfg.registry,['function lookup(string) view returns(uint256,address)'],p);
  const [,owner]=await reg.lookup(name),[,recipient]=await reg.lookup(target);
  if(owner.toLowerCase()!==account.toLowerCase())throw Error('This wallet does not own the paying username.');
  if(BigInt(recipient)===0n)throw Error('Target username is unregistered.');
  if(recipient.toLowerCase()===account.toLowerCase())throw Error('Choose a username owned by another wallet.');
  if(await new Contract(cfg.likes,cfg.abi,p).following(id(name),id(target)))throw Error('This username already follows the target.');
  const members=(await get('/pool')).members.filter(a=>a.toLowerCase()!==account.toLowerCase());
  if(!members.length)throw Error('No eligible stakers.');
  const token=new Contract(cfg.token,tokenAbi,p);
  if(await token.balanceOf(account)<fee)throw Error('Insufficient fixture CAW.');
  return {account,name,target,recipient,members,allowed:await token.allowance(account,cfg.likes)>=fee};
}
function action(k,fn){$(k).onclick=async()=>{if(busy)return;busy=true;controls();try{await fn();}catch(e){review=null;$('status').textContent=e.shortMessage||e.message;}finally{busy=false;controls();}};}
action('review',async()=>{
  if(!wallet)throw Error('Enable your local wallet.');
  await wallet.request({method:'eth_requestAccounts'});const n=epoch,r=await inspect();if(n!==epoch)return;review=r;
  $('status').textContent='Follow '+r.target+' · owner '+r.recipient+' receives 24,000. Eligible stakers share 6,000.';
});
async function send(approve){
  const old=review,n=epoch,r=await inspect();
  if(n!==epoch||!old||r.name!==old.name||r.target!==old.target||r.recipient!==old.recipient||r.account!==old.account||(!approve&&!r.allowed))throw Error('Review again.');
  const data=approve?new Interface(tokenAbi).encodeFunctionData('approve',[cfg.likes,fee]):abi.encodeFunctionData('follow',[r.name,r.target,r.recipient,r.members]);
  const h=await wallet.request({method:'eth_sendTransaction',params:[{chainId:'0x539',from:r.account,to:approve?cfg.token:cfg.likes,data}]});
  $('status').textContent='Submitted '+h;if(!approve){$('hash').value=h;location.hash=h;}
  const rc=await new BrowserProvider(wallet).waitForTransaction(h,1,60000);
  if(rc?.status!==1)throw Error('Pending or unsuccessful: '+h);
  if(approve){const fresh=await inspect();if(fresh.recipient!==r.recipient||fresh.account!==r.account)throw Error('Ownership changed. Review again.');
    if(n===epoch){review=fresh;$('status').textContent='Fee approval mined.';}}
  else{review=null;$('feed').href='http://127.0.0.1:34742/?name='+encodeURIComponent(r.name);$('status').textContent='Follow mined.';await read();}
}
action('approve',()=>send(true));action('send',()=>send(false));
function clear(){reading++;$('credits').replaceChildren();$('result').textContent='';}
async function read(){
  clear();const i=reading,h=$('hash').value.trim();
  try{
    if(!/^0x[0-9a-f]{64}$/i.test(h))throw Error('Enter the mined follow transaction hash.');
    const r=await get('/follow/'+h);if(i!==reading)return;
    $('result').textContent=r.name+' followed '+r.target+' · block '+r.block;
    for(const label of ['Followed account '+r.recipient+' received '+r.accountCredit+' fixture CAW',...r.credits.map(c=>'Staker '+c.wallet+' received '+c.amount+' fixture CAW (stake '+c.stake+')')]){
      const li=document.createElement('li');li.textContent=label;$('credits').append(li);
    }
  }catch(e){if(i===reading)$('result').textContent=e.message;}
}
$('read').onclick=read;$('hash').oninput=clear;
const target=new URLSearchParams(location.search).get('target');if(target)$('target').value=target;
if(location.hash){$('hash').value=location.hash.slice(1);read();}
