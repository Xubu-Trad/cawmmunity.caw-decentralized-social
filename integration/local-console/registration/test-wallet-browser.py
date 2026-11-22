import json,time,urllib.request
from playwright.sync_api import sync_playwright,expect
url='http://127.0.0.1:34736'
def rpc(q):
 assert q['method'] in ['eth_chainId','eth_getBlockByNumber','eth_call','eth_getBalance','eth_getTransactionCount','eth_estimateGas','eth_gasPrice','eth_sendRawTransaction','eth_getTransactionByHash','eth_getTransactionReceipt','eth_blockNumber']
 data=json.dumps(dict(q,id=1,jsonrpc='2.0')).encode()
 j=json.load(urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:34898',data,{'Content-Type':'application/json'})))
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
 page.goto(url);page.locator('#connect').click();expect(page.locator('#account')).to_contain_text('0x');account=page.locator('#account').inner_text()
 page.locator('#fund').click();expect(page.locator('#status')).to_contain_text('Test funds ready',timeout=60000)
 name='portal'+str(int(time.time()))
 page.locator('#name').fill(name);page.locator('#review').click();expect(page.locator('#quote')).to_contain_text(name)
 page.locator('#approve').click();expect(page.locator('#register')).to_be_enabled(timeout=90000);page.locator('#register').click()
 try:expect(page.locator('#status')).to_contain_text('NFT ownership verified',timeout=70000)
 except:print(page.locator('#status').inner_text());raise
 print(page.locator('#receipt').inner_text());expect(page.locator('#receipt')).to_contain_text(account)
 page.reload();page.locator('#recheck').click();expect(page.locator('#status')).to_contain_text('NFT ownership verified',timeout=60000)
 page.locator('#connect').click();page.locator('#name').fill(name);page.locator('#review').click();expect(page.locator('#status')).to_contain_text('Already registered')
 print('PASS browser: fresh locally signing wallet, fixture funds, exact approval, registration, receipt ownership, reload, duplicate name')
 browser.close()
