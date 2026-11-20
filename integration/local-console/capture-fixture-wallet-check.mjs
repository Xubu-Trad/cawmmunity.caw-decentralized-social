// Local reproduction helper for the published disposable account-2 fixture.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Wallet, Interface, keccak256 } from 'ethers';
import { withdrawalData } from './ui/withdrawal-plan.mjs';
import { acquireVerifiedReceipt } from './strict-console-acquisition.mjs';
import { exportReceiptHistory } from './ui/receipt-export.mjs';
import { OUTCOME_PREFIX } from './ui/receipt-outcomes.mjs';

const [mode, port, out] = process.argv.slice(2);
assert(/^\d{1,5}$/.test(port));
const call = async (method, params) => {
  const response = await fetch('http://127.0.0.1:' + port, {method:'POST', redirect:'error',
    signal:AbortSignal.timeout(5000), headers:{'content-type':'application/json'},
    body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
  const value = await response.json();
  assert(response.ok && !value.error, JSON.stringify(value.error));
  return value.result;
};
const read = name => JSON.parse(fs.readFileSync(new URL('../../evidence/console-withdrawal-20261116/' + name, import.meta.url)));
const config = read('withdrawal-selection.json').config;
const blocks = read('capture.json').blocks;
const parent = blocks[12].block;
const genesisHash = blocks[0].block.hash;
assert.equal(await call('eth_chainId', []),'0x7a69');
assert.equal((await call('eth_getBlockByNumber',['0x0',false])).hash,genesisHash);
assert.equal((await call('eth_getBlockByNumber',['0xc',false])).hash,parent.hash);
const abi = new Interface(['function authority(uint256) view returns(address,uint256)']);
const authority = await call('eth_call',[{to:config.contracts.registry.address,data:abi.encodeFunctionData('authority',[2])},'0xc']);
const [owner,epoch] = abi.decodeFunctionResult('authority',authority);
assert.equal(owner.toLowerCase(),config.contracts.wallet.address);
const controller = new Wallet('0x'+'3'.padStart(64,'0'));
assert.equal(controller.address.toLowerCase(),config.controller);
const nonce = await call('eth_getTransactionCount',[config.controller,'0xc']);
const data = withdrawalData(config.contracts.custody.address,String(epoch),'2','fixture-wallet');
const raw = await controller.signTransaction({type:2,chainId:31337,nonce:Number(BigInt(nonce)),
  gasLimit:500000,maxFeePerGas:2000000000,maxPriorityFeePerGas:1000000000,to:owner,value:0,data});
const hash = keccak256(raw);
if(mode==='submit'){
  assert.equal((await call('eth_getBlockByNumber',['latest',false])).hash,parent.hash);
  assert.equal(await call('eth_sendRawTransaction',[raw]),hash);
}else{
  assert.equal(mode,'check');
  const receipt=await call('eth_getTransactionReceipt',[hash]);
  assert.equal(receipt.status,'0x1');
  const contracts=Object.fromEntries(Object.entries(config.contracts).map(([k,v])=>[k,v.address]));
  const plan={chainId:'0x7a69',from:config.controller,to:contracts.wallet,data,value:'0x0',nonce,
    epoch:String(epoch),amount:'2',blockNumber:parent.number,blockHash:parent.hash,genesisHash};
  const original={version:1,scope:'LOCAL_PROVIDER_RECEIPT_CHECK',action:{version:1,id:'0x'+'ab'.repeat(16),
    phase:'submitted',plan,contracts,hash},transactionHash:hash,receipt:{status:'confirmed',
      blockHash:receipt.blockHash,blockNumber:receipt.blockNumber}};
  const state={chainId:'0x7a69',genesisHash,controller:config.controller,contracts};
  const exported=await exportReceiptHistory({getItem:k=>k===OUTCOME_PREFIX+original.action.id?JSON.stringify(original):null},
    {request:async(_name,_options,callback)=>callback({})},state,original);
  const result=await acquireVerifiedReceipt(call,{...config,genesisHash},exported.text);
  assert.equal(result.controller,config.controller);
  assert.equal(result.recipient,contracts.wallet);
  assert.deepEqual(result.discrepancies,[]);
  fs.writeFileSync(path.join(out,'wallet-proofs.json'),JSON.stringify(result.proofPackage)+'\n',{flag:'wx'});
  fs.writeFileSync(path.join(out,'wallet-selection.json'),JSON.stringify({config,startHash:parent.hash,endHash:receipt.blockHash,transactionHash:hash,amount:'2'})+'\n',{flag:'wx'});
}
