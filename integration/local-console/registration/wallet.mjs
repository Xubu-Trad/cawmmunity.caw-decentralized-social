import {BrowserProvider,Contract,Interface,formatEther,getAddress,id,ZeroAddress} from '/ethers.mjs';
const $ = key => document.getElementById(key);
const config = await (await fetch('/config')).json();
const chooser = $('wallet-choice');
const wallets = [];
let wallet;
const registryAbi = ['function lookup(string) view returns(uint256,address)','function register(string)','function ownerOf(uint256) view returns(address)','function usernameOf(uint256) view returns(string)','event Transfer(address indexed from,address indexed to,uint256 indexed tokenId)'];
const tokenAbi = ['function balanceOf(address) view returns(uint256)','function allowance(address,address) view returns(uint256)','function approve(address,uint256) returns(bool)'];
let actionReview=null,walletVersion=0;
const historyPrefix='caw-action:'+config.genesis+':'+config.registry+':'+config.token+':';
function loadHistory(selected){
  const list=$('action-history');
  list.replaceChildren();
  if(account){
    const prefix=historyPrefix+account+':';
    for(const k of Object.keys(localStorage).filter(k=>k.startsWith(prefix))){
      const hash=k.slice(prefix.length);
      list.add(new Option(hash,hash));
    }
    if(selected)list.value=selected;
  }
  refresh();
}
let account,provider,registry,token,review,busy=false,epoch=0;
const key='caw-registration:'+config.genesis+':'+config.registry;
function saved(){try{return JSON.parse(localStorage.getItem(key));}catch{return null;}}
function refresh(){
  for(const k of ['connect','fund','review','approve','register','recheck']) $(k).disabled=busy;
  $('inspect-action').disabled=busy||!account;
  $('sign-action').disabled=busy||!actionReview;
  $('recover-action').disabled=busy||!account||!$('action-history').value;
  $('action-history').disabled=busy||!account||!$('action-history').length;
  chooser.disabled=busy || wallets.length<2;
  $('fund').disabled ||= !account; $('review').disabled ||= !account;
  $('approve').disabled ||= !review || review.approved;
  $('register').disabled ||= !review?.approved;
  $('recheck-wrap').hidden=!saved();
}
function invalidate(){epoch++;actionReview=null;$('terms').textContent='';review=null;$('quote').textContent='';refresh();}
function reset(){
  walletVersion++;
  account=null;
  for(const k of ['account','receipt','action-receipt','status'])$(k).textContent='';
  loadHistory();invalidate();
}
function addWallet(candidate,label){
  if(!candidate || typeof candidate.request!=='function')return;
  const existing=wallets.indexOf(candidate);
  if(existing!==-1){
    if(label)chooser.options[existing].textContent=label;
    return;
  }
  const index=wallets.push(candidate)-1;
  chooser.add(new Option(label || 'Browser wallet',String(index)));
  if(!wallet)wallet=candidate;
  for(const event of ['chainChanged','accountsChanged']){
    candidate.on?.(event,()=>{if(wallet===candidate)reset();});
  }
  refresh();
}
chooser.onchange=()=>{
  wallet=wallets[chooser.selectedIndex];
  provider=null;registry=null;token=null;
  $('receipt').textContent='';
  $('status').textContent='Connect the selected wallet to continue.';
  reset();
};
window.addEventListener('eip6963:announceProvider',event=>{
  const detail=event.detail;
  if(typeof detail?.info?.name==='string')addWallet(detail.provider,detail.info.name);
});
window.dispatchEvent(new Event('eip6963:requestProvider'));
addWallet(window.ethereum);
$('name').addEventListener('input',invalidate);
async function check(){
  if (!wallet) throw Error('Open this portal in a browser with your local wallet enabled.');
  if (await wallet.request({method:'eth_chainId'})!=='0x539' ||
      (await wallet.request({method:'eth_getBlockByNumber',params:['0x0',false]}))?.hash!==config.genesis)
    throw Error('Select the disposable chain at '+config.endpoint+' (chain ID 1337).');
  if(account && (await wallet.request({method:'eth_accounts'}))[0]?.toLowerCase()!==account.toLowerCase()) throw Error('Reconnect the selected wallet.');
}
function action(k,fn){$(k).onclick=async()=>{if(busy)return;const version=walletVersion;busy=true;refresh();try{await fn();}catch(e){if(version===walletVersion)$('status').textContent=e.shortMessage||e.message;}finally{busy=false;refresh();}};}
action('connect',async()=>{
  if(!wallet) throw Error('Enable a browser wallet to connect.');
  if(await wallet.request({method:'eth_chainId'})!=='0x539'){
    try{await wallet.request({method:'wallet_switchEthereumChain',params:[{chainId:'0x539'}]});}
    catch(e){if(e.code!==4902)throw e;await wallet.request({method:'wallet_addEthereumChain',params:[{chainId:'0x539',chainName:'Community CAW disposable',rpcUrls:[config.endpoint],nativeCurrency:{name:'Test ether',symbol:'ETH',decimals:18}}]});}
  }
  await check();await wallet.request({method:'eth_requestAccounts'});await check();
  provider=new BrowserProvider(wallet);account=getAddress((await wallet.request({method:'eth_accounts'}))[0]);
  registry=new Contract(config.registry,registryAbi,provider); token=new Contract(config.token,tokenAbi,provider);
  loadHistory();$('account').textContent=account;$('status').textContent='Connected. Use test funds if this wallet is new.';invalidate();
});
action('fund',async()=>{await check();const a=account;invalidate();$('status').textContent='Funding local fixture wallet…';
  const res=await fetch('/fund/'+a,{method:'POST',headers:{'x-local-fixture':'1'}});if(!res.ok)throw Error(await res.text());$('status').textContent='Test funds ready. Review your name.';});
async function snapshot(name){
  if(!/^[a-z0-9]+$/.test(name))throw Error('Use lowercase letters and digits.');
  const [price,owner]=await registry.lookup(name);
  if(owner!==ZeroAddress)throw Error('Already registered to '+owner);
  const allowance=await token.allowance(account,config.registry);
  if(await token.balanceOf(account)<price)throw Error('Get test funds before registering.');
  return {name,price,approved:allowance>=price,account};
}
action('review',async()=>{invalidate();await check();const n=epoch,r=await snapshot($('name').value);if(n!==epoch)return;
  review=r;
  const amount=formatEther(r.price)+' fixture CAW';
  const rows=['Username: '+r.name,'Selected signer: '+r.account];
  if(!r.approved)rows.push('Approval transaction destination (CAW token): '+token.target,
    'Allowance spender (registry): '+registry.target,'Exact approval amount: '+amount);
  rows.push('Registration price: '+amount,'Registration payment sink: '+config.sink,'NFT recipient: '+r.account);
  $('quote').replaceChildren(...rows.map(text=>{
    const row=document.createElement('div');
    row.textContent=text;
    return row;
  }));
  $('status').textContent=r.approved?'Ready to register.':'Review the price, then approve it in your wallet.';});
async function submit(kind){
  const r=review,n=epoch;await check();const fresh=await snapshot(r.name);
  if(n!==epoch||fresh.price!==r.price||fresh.account!==r.account||$('name').value!==r.name)throw Error('Review the name again.');
  const approve=kind==='approve';
  if(!approve&&!fresh.approved)throw Error('Approve the quoted amount first.');
  const target=approve?token:registry;
  const data=approve?token.interface.encodeFunctionData('approve',[config.registry,r.price]):registry.interface.encodeFunctionData('register',[r.name]);
  await check();if(n!==epoch)throw Error('Review changed.');
  const hash=await wallet.request({method:'eth_sendTransaction',params:[{from:r.account,to:target.target,data,chainId:'0x539'}]});
  $('status').textContent='Submitted '+hash;
  if(!approve){const record={hash,name:r.name,account:r.account};localStorage.setItem(key,JSON.stringify(record));invalidate();await verify(record);return;}
  const receipt=await provider.waitForTransaction(hash,1,60000);
  if(receipt?.status!==1)throw Error('Approval pending or unsuccessful. Review again.');
  if(n===epoch){await check();const updated=await snapshot(r.name);if(n===epoch)review=updated;}
  $('status').textContent='Approval mined. Review the registration in your wallet.';
}
action('approve',()=>submit('approve'));action('register',()=>submit('register'));
async function verify(record){
  await check();const p=new BrowserProvider(wallet),rc=await p.waitForTransaction(record.hash,1,45000);
  if(!rc)throw Error('Still pending. Use Recheck mined registration.');
  if(rc.status!==1)throw Error('Registration reverted. No NFT was minted.');
  const iface=new Interface(registryAbi),tid=BigInt(id(record.name));
  const tx=await p.getTransaction(record.hash);
  if(tx?.to!==config.registry||tx.from!==record.account||tx.data!==iface.encodeFunctionData('register',[record.name])||tx.value!==0n)throw Error('Registration transaction mismatch.');
  const minted=rc.logs.some(l=>{if(l.address!==config.registry)return false;try{const e=iface.parseLog(l);return e?.name==='Transfer'&&e.args.from===ZeroAddress&&e.args.to===record.account&&e.args.tokenId===tid;}catch{return false;}});
  const at={blockHash:rc.blockHash,requireCanonical:true};
  async function read(method){const data=iface.encodeFunctionData(method,[tid]);const raw=await wallet.request({method:'eth_call',params:[{to:config.registry,data},at]});return iface.decodeFunctionResult(method,raw)[0];}
  if(!minted||await read('ownerOf')!==record.account||await read('usernameOf')!==record.name)throw Error('Mint event or mined ownership did not match.');
  await check();$('receipt').textContent=[record.name,'Owner: '+record.account,'Transaction: '+record.hash,'Block '+rc.blockNumber+': '+rc.blockHash].join('\n');
  $('status').textContent='NFT ownership verified at the mined block.';
}
action('recheck',async()=>{if(!saved())throw Error('No saved registration.');await verify(saved());});
refresh();

if(config.actions){
  const {prepareAction}=await import('/runtime-actions.mjs');
  $('runtime').hidden=false;
  $('legacy-post').hidden=true;
  $('argument').oninput=invalidate;
  $('operation').onchange=()=>{
    $('argument').value='';
    $('argument-label').textContent={post:'Post text',like:'Original post transaction hash',recaw:'Original post transaction hash',follow:'Username to follow',deposit:'CAW amount',withdraw:'CAW amount'}[$('operation').value];
    invalidate();
  };
  async function inspect(){
    await check();
    return prepareAction(config,provider,account,$('operation').value,$('name').value,$('argument').value);
  }
  action('inspect-action',async()=>{
    invalidate();const n=epoch,r=await inspect();
    if(n!==epoch)return;
    actionReview=r;$('terms').textContent=r.summary;
    $('sign-action').textContent=r.needsApproval?'Approve exact amount':'Sign action';
  });
  async function showReceipt(record,p,version,wait){
    const {hash,sender,to,data,approval}=record;
    const rc=wait?await p.waitForTransaction(hash,1,60000):await p.getTransactionReceipt(hash);
    if(version!==walletVersion)return;
    if(!rc)throw Error('Receipt unavailable. Recheck the saved hash.');
    const tx=await p.getTransaction(hash);
    const block=await p.getBlock(rc.blockNumber);
    if(version!==walletVersion)return;
    if(rc.hash!==hash||rc.from!==sender||tx?.from!==sender||tx.hash!==hash||
       tx.to!==to||tx.data!==data||tx.value!==0n||tx.blockHash!==rc.blockHash||block?.hash!==rc.blockHash)
      throw Error('Mined transaction did not match the review.');
    if(rc.status!==1)throw Error('Transaction reverted: '+hash);
    $('action-receipt').textContent=(approval?'Approval mined. Review the action again.':'Action mined.')+' '+hash+' · '+sender;
    $('status').textContent='';
  }
  $('action-history').onchange=()=>{$('action-receipt').textContent='';refresh();};
  action('recover-action',async()=>{
    const version=walletVersion,p=provider,hash=$('action-history').value,sender=account;
    $('action-receipt').textContent='';
    await check();
    if(version!==walletVersion)return;
    const record=JSON.parse(localStorage.getItem(historyPrefix+sender+':'+hash));
    if(record?.sender!==sender||record.hash!==hash)throw Error('Saved transaction context mismatch.');
    await showReceipt(record,p,version,false);
  });
  action('sign-action',async()=>{
    const n=epoch,old=actionReview,r=await inspect();
    await check();
    if(n!==epoch||!old||JSON.stringify(old)!==JSON.stringify(r)){invalidate();throw Error('Action changed. Review again.');}
    const sender=account,p=provider,version=walletVersion;
    invalidate();
    const hash=await wallet.request({method:'eth_sendTransaction',params:[{...r.tx,from:sender,chainId:'0x539'}]});
    const record={hash,sender,to:getAddress(r.tx.to),data:r.tx.data,approval:r.needsApproval};
    localStorage.setItem(historyPrefix+sender+':'+hash,JSON.stringify(record));
    if(version!==walletVersion)return;
    loadHistory(hash);
    $('action-receipt').textContent='Submitted '+hash;
    try{await showReceipt(record,p,version,true);}
    catch(e){
      if(version===walletVersion && e.code==='TIMEOUT'){
        $('status').textContent='Timed out waiting for receipt. Recheck the saved hash.';
        return;
      }
      throw e;
    }
  });
}
