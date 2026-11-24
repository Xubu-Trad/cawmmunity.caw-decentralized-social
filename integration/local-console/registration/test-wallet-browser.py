import argparse,json,time,urllib.request
parser=argparse.ArgumentParser()
parser.add_argument("--runtime-post",help="post hash from the disposable runtime launcher")
args=parser.parse_args()
from playwright.sync_api import sync_playwright,expect
url='http://127.0.0.1:34736'
config=json.load(urllib.request.urlopen(url+"/config"))
endpoint=config["endpoint"]
from urllib.parse import urlsplit
assert urlsplit(endpoint).hostname=="127.0.0.1"
def rpc(q):
 assert q['method'] in ['eth_chainId','eth_getBlockByNumber','eth_call','eth_getBalance','eth_getTransactionCount','eth_estimateGas','eth_gasPrice','eth_sendRawTransaction','eth_getTransactionByHash','eth_getTransactionReceipt','eth_blockNumber','eth_getStorageAt']
 data=json.dumps(dict(q,id=1,jsonrpc='2.0')).encode()
 j=json.load(urllib.request.urlopen(urllib.request.Request(endpoint,data,{'Content-Type':'application/json'})))
 if 'error' in j:raise RuntimeError(j['error'])
 return j['result']
with sync_playwright() as pw:
 browser=pw.chromium.launch();page=browser.new_page();page.expose_function('fixtureRpc',rpc)
 page.add_init_script("""window.ethereum={on(){},async request(q){
 const {Wallet}=await import('/ethers.mjs');const w=window.testSigner ||= (sessionStorage.tkey?new Wallet(sessionStorage.tkey):Wallet.createRandom());sessionStorage.tkey=w.privateKey;
 if(['eth_accounts','eth_requestAccounts'].includes(q.method))return [w.address];
 if(q.method==='eth_sendTransaction'){const tx=q.params[0],rpc=(method,params)=>window.fixtureRpc({method,params});
 const raw=await w.signTransaction({type:0,chainId:1337,nonce:Number(await rpc('eth_getTransactionCount',[w.address,'pending'])),gasLimit:BigInt(await rpc('eth_estimateGas',[tx]))+50000n,gasPrice:BigInt(await rpc('eth_gasPrice',[])),to:tx.to,data:tx.data});
 return rpc('eth_sendRawTransaction',[raw]);}return window.fixtureRpc(q);}}""")
 if args.runtime_post:
  page.add_init_script("""addEventListener('eip6963:requestProvider',()=>{
    const signer=window.ethereum;
    window.ethereum={request(){throw Error('Unselected provider used')}};
    for(const [name,provider] of [['Decoy',window.ethereum],['Test signer',signer]]){
      dispatchEvent(new CustomEvent('eip6963:announceProvider',{detail:{info:{name},provider}}));
    }
  });""")
 page.goto(url);
 if args.runtime_post:page.locator('#wallet-choice').select_option(label='Test signer')
 page.locator('#connect').click();expect(page.locator('#account')).to_contain_text('0x');account=page.locator('#account').inner_text()
 page.locator('#fund').click();expect(page.locator('#status')).to_contain_text('Test funds ready',timeout=60000)
 name='portal'+str(int(time.time()))
 page.locator('#name').fill(name);page.locator('#review').click();expect(page.locator('#quote')).to_contain_text(name)
 page.locator('#approve').click();expect(page.locator('#register')).to_be_enabled(timeout=90000);page.locator('#register').click()
 try:expect(page.locator('#status')).to_contain_text('NFT ownership verified',timeout=70000)
 except:print(page.locator('#status').inner_text());raise
 print(page.locator('#receipt').inner_text());expect(page.locator('#receipt')).to_contain_text(account)
 page.reload()
 if args.runtime_post:page.locator('#wallet-choice').select_option(label='Test signer')
 page.locator('#recheck').click();expect(page.locator('#status')).to_contain_text('NFT ownership verified',timeout=60000)
 page.locator('#connect').click();page.locator('#name').fill(name);page.locator('#review').click();expect(page.locator('#status')).to_contain_text('Already registered')
 print('PASS browser: fresh locally signing wallet, fixture funds, exact approval, registration, receipt ownership, reload, duplicate name')
 if args.runtime_post:
  for kind,value in [('post','selected wallet proof'),('like',args.runtime_post),('recaw',args.runtime_post),('follow','hunter01'),('deposit','10'),('withdraw','10')]:
   page.select_option('#operation',kind);page.fill('#argument',value)
   for approval in ([True,False] if kind!='withdraw' else [False]):
    page.click('#inspect-action')
    expect(page.locator('#terms')).to_contain_text(account,timeout=30000)
    expect(page.locator('#sign-action')).to_have_text('Approve exact amount' if approval else 'Sign action')
    role={'post':'posts','like':'likes','recaw':'recaw','follow':'follow','deposit':'vault','withdraw':'vault'}[kind]
    terms=page.locator('#terms').inner_text().lower()
    if approval:
     assert 'approval transaction to token '+config['token'].lower() in terms
     assert 'spender '+config['actions'][role].lower() in terms
    else:
     assert 'action transaction to '+config['actions'][role].lower() in terms
    previous=page.locator('#action-receipt').inner_text()
    page.click('#sign-action')
    page.wait_for_function("([old,prefix])=>{const t=document.querySelector('#action-receipt').textContent;return t!==old && t.startsWith(prefix)}",arg=[previous,'Approval mined.' if approval else 'Action mined.'],timeout=90000)
   print(kind,page.locator('#action-receipt').inner_text(),flush=True)
 browser.close()
