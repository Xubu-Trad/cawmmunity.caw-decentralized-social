import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createInterface} from 'node:readline';
import {Contract, ContractFactory, JsonRpcProvider, MaxUint256, ZeroAddress,
  solidityPackedKeccak256, zeroPadValue, toBeHex, keccak256, id, parseEther} from 'ethers';
import {exerciseAccountActions} from './exercise-caw-actions.mjs';
import solc from 'solc';
import {verifyRuntime} from './verify-runtime.mjs';
import {capturePostCapsule} from './post-capsule.mjs';
import {verifyPostCapsule} from './verify-post-capsule.mjs';
import {createLocalRpc} from '../local-rpc.mjs';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const capture=JSON.parse(read('../../../reference/fixtures/caw-token-publicnode.json'));
const runtime=capture.calls.find(c=>c.request.method==='eth_getCode').response.result;
const expected='0x6ee560d3e6b1f881a8711e0be0b30a0e8e0cf8b915ce8f75ea05002126c94256';
assert.equal(keccak256(runtime),expected);
const names=['CawUsernameRegistration','UsernameRegistration','StakedNamePosts','PaidLikes','PaidReCAWs','PaidFollows'];
const sources=Object.fromEntries(names.map(n=>['registration/'+n+'.sol',{content:read(n+'.sol')}]));
sources['UsernameTerms.sol']={content:read('../UsernameTerms.sol')};
const build=JSON.parse(solc.compile(JSON.stringify({language:'Solidity',sources,
  settings:{viaIR:true,optimizer:{enabled:true,runs:200},evmVersion:'shanghai',outputSelection:{'*':{'*':['abi','evm.bytecode.object']}}}}),
  {import:path=>({contents:read('node_modules/'+path)})}));
assert.deepEqual((build.errors??[]).filter(e=>e.severity==='error'),[]);

// Port zero and the startup line bind all fixture writes to this child node.
const node=spawn('anvil',['--host','127.0.0.1','--port','0','--chain-id','1337','--hardfork','shanghai'],
  {stdio:['ignore','pipe','inherit']});
const stopped=once(node,'exit');
let provider, archivedPost, mixedPost, reorgPost;
try {
  const lines=createInterface({input:node.stdout});
  let endpoint;
  for await(const line of lines){
    const m=/Listening on (127\.0\.0\.1:\d+)/.exec(line);
    if(m){endpoint='http://'+m[1];break;}
  }
  assert.ok(endpoint,'fresh node startup');
  provider=new JsonRpcProvider(endpoint);
  provider.pollingInterval=100;
  const [payer,staker]=await Promise.all([0,1].map(i=>provider.getSigner(i)));
  const word=n=>zeroPadValue(toBeHex(n),32);
  const supply=parseEther('4000000');
  await provider.send('anvil_setCode',[capture.token,runtime]);
  const balanceSlot=solidityPackedKeccak256(['bytes32','bytes32'],[zeroPadValue(payer.address,32),word(0)]);
  await provider.send('anvil_setStorageAt',[capture.token,balanceSlot,word(supply)]);
  await provider.send('anvil_setStorageAt',[capture.token,word(2),word(supply)]);
  const token=new Contract(capture.token,['function totalSupply() view returns(uint256)','function balanceOf(address) view returns(uint256)',
    'function allowance(address,address) view returns(uint256)','function approve(address,uint256) returns(bool)',
    'function transfer(address,uint256) returns(bool)'],payer);
  assert.equal(await token.totalSupply(),supply);
  assert.equal(await token.balanceOf(payer.address),supply);
  function factory(n){
    const a=build.contracts['registration/'+n+'.sol'][n];
    return new ContractFactory(a.abi,a.evm.bytecode.object,payer);
  }
  async function deploy(n,arg){return (await factory(n).deploy(arg)).waitForDeployment();}
  const registry=await deploy('CawUsernameRegistration',capture.token);
  await assert.rejects(factory('CawUsernameRegistration').deploy(registry.target),e=>e.code==='CALL_EXCEPTION');
  assert.equal(await registry.CAW_RUNTIME(),expected);
  await assert.rejects(token.transfer.staticCall(ZeroAddress,1n),/zero address/);
  const mine=async tx=>{const rc=await (await tx).wait();assert.equal(rc.status,1);return rc;};
  const name='hunter01',tokenId=BigInt(id(name)),[price]=await registry.lookup(name);
  await mine(token.approve(registry.target,MaxUint256));
  await mine(registry.register(name));
  assert.equal(await registry.ownerOf(tokenId),payer.address);
  assert.equal(await token.balanceOf(await registry.SINK()),price);
  assert.equal(await token.allowance(payer.address,registry.target),MaxUint256-price);
  const pool=await deploy('StakedNamePosts',registry.target);
  const stake=parseEther('100'),fee=parseEther('5000');
  await mine(token.transfer(staker.address,stake));
  await mine(token.connect(staker).approve(pool.target,stake));
  await mine(pool.connect(staker).stake(stake));
  await mine(token.approve(pool.target,fee));
  await assert.rejects(pool.connect(staker).publish.staticCall(name,'other owner'),/NFT_OWNER/);
  await assert.rejects(pool.publish.staticCall(name,'A'.repeat(421)),e=>e.code==='CALL_EXCEPTION');
  assert.equal(await token.allowance(payer.address,pool.target),fee);
  const post=await mine(pool.publish(name,'A'.repeat(420)));
  assert.equal(await token.balanceOf(staker.address),fee);
  assert.equal(await token.balanceOf(pool.target),stake);
  assert.equal(await token.allowance(payer.address,pool.target),0n);
  assert.equal(await token.balanceOf(payer.address),supply-price-fee-stake);
  const actions=await exerciseAccountActions({provider,registry,token,pool,payer,staker,name,post,deploy,mine,read});
  const beforeExit=await token.balanceOf(staker.address);
  await mine(pool.connect(staker).unstake());
  assert.equal(await token.balanceOf(staker.address),beforeExit+stake);
  assert.equal(await token.balanceOf(pool.target),0n);

  assert.equal(await token.totalSupply(),supply);
  console.log(JSON.stringify({runtime:expected,name,sink:await registry.SINK(),price:price.toString(),
    post:post.hash,credit:fee.toString(),withdrawnStake:stake.toString(),totalSupplyUnchanged:true}));
  const checkpoint=(await provider.send('eth_getBlockByNumber',['latest',false])).hash;
  const rpc=createLocalRpc(endpoint);
  const capsule=await capturePostCapsule(rpc,post.blockHash,post.hash);
  await assert.rejects(capturePostCapsule(async(method,params)=>{
    const response=await rpc(method,params);
    if(method==='eth_getBlockByHash')return {...response,transactions:[post.hash,post.hash]};
    return response;
  },post.blockHash,post.hash));
  await assert.rejects(capturePostCapsule(async(method,params)=>{
    if(method==='eth_getBlockByNumber')return null;
    return rpc(method,params);
  },post.blockHash,post.hash),/no longer canonical/);
  archivedPost={bytes:JSON.stringify(capsule),blockHash:post.blockHash,txHash:post.hash,
    name,author:payer.address,staker:staker.address};
  const verified=await verifyRuntime(rpc,checkpoint,name);
  assert.equal(verified.authority.registry.username.owner,payer.address);
  assert.equal(verified.authority.registry.username.approvedForTransfer,ZeroAddress);
  for(const key of ['implementation','admin','beacon']){
    const slot=toBeHex(BigInt(id('eip1967.proxy.'+key))-1n,32);
    await assert.rejects(verifyRuntime(async(method,params)=>{
      if(method==='eth_getStorageAt' && params[0]===actions.vault && params[1]===slot)return word(1);
      return rpc(method,params);
    },checkpoint),new RegExp('vault: unexpected EIP-1967 '+key));
  }
  await assert.rejects(verifyRuntime(async(method,params)=>{
    if(method==='eth_call' && params[0].to===actions.recaw && params[0].data===id('source()').slice(0,10))return word(0);
    return rpc(method,params);
  },checkpoint),/unexpected source binding/);
  const transferred=await verifyRuntime(rpc,checkpoint,'reader01');
  assert.equal(transferred.authority.registry.username.owner,(await provider.getSigner(4)).address);
  assert.equal(transferred.authority.registry.username.epoch,'2');
  assert.equal(verified.contracts.length,7);
  console.log(JSON.stringify({endpoint,runtimeVerification:verified}));
  await assert.rejects(verifyRuntime(async(method,params)=>{
    if(method==='eth_getCode' && params[0].toLowerCase()===actions.vault.toLowerCase())return '0x00';
    return rpc(method,params);
  },checkpoint),/Runtime mismatch: vault/);
  await assert.rejects(verifyRuntime(async(method,params)=>{
    if(method==='eth_getBlockByNumber')return null;
    return rpc(method,params);
  },checkpoint),/Checkpoint changed/);
  if(process.argv.includes('--watch-following')){
    const {testFollowingWatch}=await import('./test-following-watch.mjs');
    await testFollowingWatch({endpoint,rpc,provider,token,pool,staker,payer,stake,fee,mine,name});
  }
  if(process.env.CAW_PEER_POST_INPUT){
    const {writePeerPostInput}=await import('./write-peer-post-input.mjs');
    const snapshot=await rpc('evm_snapshot',[]);
    try{
      await writePeerPostInput({file:process.env.CAW_PEER_POST_INPUT,rpc,token,pool,staker,payer,
        stake,fee,mine,runtime,balanceSlot,supply,word});
    }finally{
      assert.equal(await rpc('evm_revert',[snapshot]),true);
    }
  }
  if(process.argv.includes('--mixed-post')){
    await mine(token.connect(staker).approve(pool.target,stake));
    await mine(pool.connect(staker).stake(stake));
    await mine(token.approve(pool.target,2n*fee));
    const previousHeight=await rpc('eth_blockNumber',[]);
    const balanceBefore=await token.balanceOf(staker.address,{blockTag:previousHeight});
    const transferAmount=parseEther('37');
    const nonce=await payer.getNonce('pending');
    await rpc('evm_setAutomine',[false]);
    let transfer,selected,other;
    try{
      transfer=await token.transfer(staker.address,transferAmount,{nonce,gasLimit:100000});
      selected=await pool.publish(name,'middle paid post',{nonce:nonce+1,gasLimit:750000});
      other=await pool.publish(name,'last paid post',{nonce:nonce+2,gasLimit:750000});
      await rpc('evm_mine',[]);
    }finally{await rpc('evm_setAutomine',[true]);}
    const receipt=await selected.wait();
    const block=await rpc('eth_getBlockByHash',[receipt.blockHash,false]);
    assert.deepEqual(block.transactions,[transfer.hash,selected.hash,other.hash]);
    assert.equal(receipt.status,1);
    const balanceAfter=await token.balanceOf(staker.address,{blockTag:block.number});
    assert.equal(balanceAfter-balanceBefore,2n*fee+transferAmount);
    const archive=await capturePostCapsule(rpc,block.hash,selected.hash);
    mixedPost={archive,blockHash:block.hash,selected:selected.hash,other:other.hash,transfer:transfer.hash,
      staker:staker.address,author:payer.address,name,blockGain:'10037.0'};
  }
  if(process.argv.includes('--reorg-post')){
    const {mineCheckpointBranches}=await import('./test-post-checkpoint.mjs');
    reorgPost=await mineCheckpointBranches({rpc,token,pool,staker,stake,fee,mine,name});
  }
  if(process.argv.includes('--portal')){
    await mine(token.transfer(staker.address,stake));
    await mine(token.connect(staker).approve(pool.target,stake));
    await mine(pool.connect(staker).stake(stake));
    const server=spawn(process.execPath,[new URL('wallet-server.mjs',import.meta.url).pathname,endpoint,registry.target],{
      stdio:'inherit',env:{...process.env,CAW_RUNTIME_ACTIONS:JSON.stringify({...actions,posts:pool.target})}});
    const stop=()=>server.kill();
    process.once('SIGTERM',stop);
    process.once('SIGINT',stop);
    try {const [code,signal]=await once(server,'exit');if(code!==0 && signal!=='SIGTERM')throw Error('Portal stopped unexpectedly');}
    finally {process.off('SIGTERM',stop);process.off('SIGINT',stop);server.kill();}
  }
} finally {
  provider?.destroy();
  if(node.exitCode===null && node.signalCode===null)node.kill();
  await stopped;
}

// Verify only the portable bytes and the independently retained identifiers after
// the fixture's RPC server exits. No live receipt, browser or wallet is available.
const {bytes,blockHash,txHash}=archivedPost;
const capsule=JSON.parse(bytes);
const result=verifyPostCapsule(capsule,blockHash,txHash);
assert.equal(result.hash,txHash);
assert.equal(result.blockHash,blockHash);
assert.equal(result.name,archivedPost.name);
assert.equal(result.body,'A'.repeat(420));
assert.equal(result.author,archivedPost.author);
assert.equal(result.fee,'5000.0');
assert.deepEqual(result.credits,[{staker:archivedPost.staker,weight:'100.0',amount:'5000.0'}]);

assert.throws(()=>verifyPostCapsule(capsule,id('different block'),txHash));
assert.throws(()=>verifyPostCapsule(capsule,blockHash,id('different transaction')));
for(const field of ['header','txBytes','receipt']){
  const data=capsule[field];
  const changed=data.slice(0,-1)+(data.endsWith('0')?'1':'0');
  assert.throws(()=>verifyPostCapsule({...capsule,[field]:changed},blockHash,txHash));
}
console.log(JSON.stringify({offlinePost:{blockHash,txHash,fee:result.fee,credits:result.credits}}));

// The two posts and the direct transfer all paid the same staker in one block.
// Its overall balance change must not be used as either post's receipt.
if(mixedPost){
  const {archive,blockHash,selected,other,transfer,staker,author,name,blockGain}=mixedPost;
  for(const [hash,body] of [[selected,'middle paid post'],[other,'last paid post']]){
    const item=verifyPostCapsule(archive,blockHash,hash);
    assert.equal(item.hash,hash);
    assert.equal(item.name,name);
    assert.equal(item.author,author);
    assert.equal(item.body,body);
    assert.equal(item.fee,'5000.0');
    assert.deepEqual(item.credits,[{staker,weight:'100.0',amount:'5000.0'}]);
  }
  assert.throws(()=>verifyPostCapsule(archive,blockHash,transfer));
  assert.throws(()=>verifyPostCapsule(archive,id('wrong mixed block'),selected));
  assert.throws(()=>verifyPostCapsule(archive,blockHash,id('absent post')));
  for(const field of ['transactions','receipts']){
    const rows=archive[field];
    assert.equal(rows.length,3);
    for(const replacement of [[rows[1],rows[0],rows[2]],rows.slice(1),[rows[0],rows[1],rows[1]]]){
      assert.throws(()=>verifyPostCapsule({...archive,[field]:replacement},blockHash,selected));
    }
  }
  if(process.env.CAW_MIXED_SAMPLE){
    writeFileSync(process.env.CAW_MIXED_SAMPLE,JSON.stringify(archive)+'\n',{flag:'wx'});
  }
  console.log(JSON.stringify({mixedPost:{blockHash,selected,other,transfer,blockGain,fee:'5000.0'}}));
}

if(reorgPost){
  const {checkArchivedBranches}=await import('./test-post-checkpoint.mjs');
  checkArchivedBranches(reorgPost);
  if(process.env.CAW_REORG_SAMPLE){
    writeFileSync(process.env.CAW_REORG_SAMPLE,JSON.stringify(reorgPost)+'\n',{flag:'wx'});
  }
  const {original,replacement}=reorgPost;
  console.log(JSON.stringify({archivedPostCheckpoints:{original,replacement}}));
}
