import assert from 'node:assert/strict';
import {execFile, spawn} from 'node:child_process';
import {once} from 'node:events';
import {promisify} from 'node:util';
import {setTimeout as delay} from 'node:timers/promises';
import {Contract, JsonRpcProvider, parseEther} from 'ethers';
import {createLocalRpc} from '../local-rpc.mjs';
import {readStakeWindow} from './stake-window.mjs';

const cwd = new URL('.', import.meta.url);
const endpoint = 'http://127.0.0.1:38653';
const reader = 'http://127.0.0.1:38654';
const rpc = createLocalRpc(endpoint);
const provider = new JsonRpcProvider(endpoint, 1337, {cacheTimeout:-1});
provider.pollingInterval = 100;
const children = [];
function start(command,args) {
  const child = spawn(command,args,{cwd,stdio:['ignore','pipe','inherit']});
  children.push(child);
  return child;
}
async function ready(child, probe) {
  for(let i=0;i<100;i++){
    if(child.exitCode !== null) throw Error('Test process exited: '+child.exitCode);
    try {return await probe();} catch {await delay(100);}
  }
  throw Error('Test process did not become ready.');
}
try {
  const node = start('anvil',['--host','127.0.0.1','--port','38653','--chain-id','1337','--order','fifo','--silent']);
  await ready(node,()=>rpc('eth_chainId',[]));
  const {stdout} = await promisify(execFile)(process.execPath,['test-registration.mjs',endpoint],{cwd});
  const registry = stdout.match(/Local registry: (0x[0-9a-fA-F]{40})/)[1];
  const service = start(process.execPath,['staked-post-service.mjs',endpoint,registry,'--deploy','38654']);
  const config = await ready(service,async()=>(await fetch(reader+'/config')).json());
  const [author, permanent, transient] = await Promise.all([0,1,2].map(i=>provider.getSigner(i)));
  const token = new Contract(config.token,['function approve(address,uint256)','function transfer(address,uint256)'],author);
  const names = new Contract(registry,['function register(string)'],author);
  const pool = new Contract(config.posts,['function stake(uint256)','function unstake()','function publish(string,string)'],author);
  const mine = async tx => (await tx).wait();
  await mine(token.approve(registry,parseEther('1000000')));
  await mine(names.register('window01'));
  await mine(token.approve(config.posts,parseEther('5000')));
  for(const [signer,size] of [[permanent,'100'],[transient,'300']]){
    await mine(token.transfer(signer.address,parseEther(size)));
    await mine(token.connect(signer).approve(config.posts,parseEther(size)));
  }
  await mine(pool.connect(permanent).stake(parseEther('100')));
  await rpc('evm_setAutomine',[false]);
  const gas={gasLimit:1000000};
  const enter=await pool.connect(transient).stake(parseEther('300'),gas);
  const post=await pool.publish('window01','stake at publication',gas);
  const exit=await pool.connect(transient).unstake(gas);
  await rpc('evm_mine',[]);
  const receipt=await post.wait();
  const block=await rpc('eth_getBlockByHash',[receipt.blockHash,false]);
  assert.deepEqual(block.transactions,[enter.hash,post.hash,exit.hash]);
  const response=await fetch(reader+'/post/'+post.hash);
  const body=await response.text();
  assert.equal(response.status,200,body);
  const result=JSON.parse(body);
  assert.deepEqual(result.credits.map(c=>[c.staker,c.amount]),[[permanent.address,'1250.0'],[transient.address,'3750.0']]);
  assert.deepEqual(result.stakeWindow,{participant:transient.address,stakeTransaction:enter.hash,exitTransaction:exit.hash,
    parentHash:block.parentHash,before:'0.0',atPublication:'300.0',after:'0.0',eligible:'400.0'});
  const paid=result.credits.map(c=>({staker:c.staker,weight:parseEther(c.weight)}));
  const verify=(query,entries)=>readStakeWindow(query,block,1,config.posts,author.address,entries,parseEther('400'));
  await assert.rejects(verify(rpc,[{...paid[0],weight:paid[0].weight+1n},paid[1]]),/recipient weight/);
  const badReceipt=async(method,args)=>{
    const value=await rpc(method,args);
    return method==='eth_getTransactionReceipt'?{...value,transactionIndex:'0x1'}:value;
  };
  await assert.rejects(verify(badReceipt,paid),/receipt inclusion/);
  const wrongBoundary=async(method,args)=>{
    if(method==='eth_call' && args[1].blockHash===block.hash) return '0x'+'00'.repeat(32);
    return rpc(method,args);
  };
  await assert.rejects(verify(wrongBoundary,paid),/boundary/);
  console.log(JSON.stringify({post:post.hash,block:block.hash,credits:result.credits,window:result.stakeWindow,negativeControls:3}));
} finally {
  provider.destroy();
  for(const child of children.reverse()) if(child.exitCode===null && child.signalCode===null){
    const stopped=once(child,'exit');
    child.kill();
    await stopped;
  }
}
