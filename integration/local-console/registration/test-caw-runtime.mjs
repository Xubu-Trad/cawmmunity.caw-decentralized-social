import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createInterface} from 'node:readline';
import {Contract, ContractFactory, JsonRpcProvider, MaxUint256, ZeroAddress,
  solidityPackedKeccak256, zeroPadValue, toBeHex, keccak256, id, parseEther} from 'ethers';
import solc from 'solc';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const capture=JSON.parse(read('../../../reference/fixtures/caw-token-publicnode.json'));
const runtime=capture.calls.find(c=>c.request.method==='eth_getCode').response.result;
const expected='0x6ee560d3e6b1f881a8711e0be0b30a0e8e0cf8b915ce8f75ea05002126c94256';
assert.equal(keccak256(runtime),expected);
const names=['CawUsernameRegistration','UsernameRegistration','StakedNamePosts'];
const sources=Object.fromEntries(names.map(n=>['registration/'+n+'.sol',{content:read(n+'.sol')}]));
sources['UsernameTerms.sol']={content:read('../UsernameTerms.sol')};
const build=JSON.parse(solc.compile(JSON.stringify({language:'Solidity',sources,
  settings:{evmVersion:'shanghai',outputSelection:{'*':{'*':['abi','evm.bytecode.object']}}}}),
  {import:path=>({contents:read('node_modules/'+path)})}));
assert.deepEqual((build.errors??[]).filter(e=>e.severity==='error'),[]);

// Port zero and the startup line bind all fixture writes to this child node.
const node=spawn('anvil',['--host','127.0.0.1','--port','0','--chain-id','1337','--hardfork','shanghai'],
  {stdio:['ignore','pipe','inherit']});
const stopped=once(node,'exit');
let provider;
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
  const supply=parseEther('2000000');
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
  await mine(pool.connect(staker).unstake());
  assert.equal(await token.balanceOf(staker.address),fee+stake);
  assert.equal(await token.balanceOf(pool.target),0n);
  assert.equal(await token.balanceOf(payer.address),supply-price-fee-stake);
  assert.equal(await token.totalSupply(),supply);
  console.log(JSON.stringify({runtime:expected,name,sink:await registry.SINK(),price:price.toString(),
    post:post.hash,credit:fee.toString(),withdrawnStake:stake.toString(),totalSupplyUnchanged:true}));
} finally {
  provider?.destroy();
  if(node.exitCode===null && node.signalCode===null)node.kill();
  await stopped;
}
