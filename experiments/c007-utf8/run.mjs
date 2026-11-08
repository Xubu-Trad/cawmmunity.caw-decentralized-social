import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {keccak_256} from '@noble/hashes/sha3.js';
import {secp256k1} from '@noble/curves/secp256k1.js';
import {createAddressFromPrivateKey,createAddressFromString} from '@ethereumjs/util';
import {Common,Hardfork,Mainnet} from '@ethereumjs/common';
import {createEVM} from '@ethereumjs/evm';

const [parent,fixturePath,out]=process.argv.slice(2);
assert(parent && fixturePath && out && !fs.existsSync(out));
fs.mkdirSync(out);

const read=p=>JSON.parse(fs.readFileSync(p));
const save=(n,v)=>fs.writeFileSync(
  `${out}/${n}`,JSON.stringify(v,null,2)+'\n',{flag:'wx'}
);

const K=b=>Buffer.from(keccak_256(b));
const KS=s=>K(Buffer.from(s,'utf8'));
const W=x=>Buffer.from(BigInt(x).toString(16).padStart(64,'0'),'hex');
const ABI=xs=>Buffer.concat(xs.map(W));
const hex=b=>Buffer.from(b).toString('hex');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');

const fixtures=read(fixturePath);
const compiled=read(`${parent}/compile/compiler-output.json`);
const profile=read(`${parent}/compile/results.json`);
const contracts=compiled.contracts['IntegratedCustodyStakeResearch.sol'];

const vaultCode=Buffer.from(
  contracts.AccountRootBoundaryResearch.evm.deployedBytecode.object,'hex'
);
const tokenCode=Buffer.from(
  contracts.MockTokenResearch.evm.deployedBytecode.object,'hex'
);

assert.equal(profile.schema,'caw-c007-utf8-scalar-compile/1');
assert.equal(sha(vaultCode),profile.runtimeSha256);
assert.equal(vaultCode.length,profile.runtimeBytes);
assert(tokenCode.length>0 && tokenCode.length<=24576);

const addr=s=>createAddressFromString(s);
const VAULT=addr('0x000000000000000000000000000000000000ca10');
const TOKEN=addr('0x000000000000000000000000000000000000ca77');
const RELAY=addr('0x3333333333333333333333333333333333333333');
const B=addr('0x2222222222222222222222222222222222222222');
const OTHER=addr('0x000000000000000000000000000000000000ca11');

const key1=W(1n),key2=W(2n);
const A=createAddressFromPrivateKey(key1);
assert.equal(A.toString().toLowerCase(),
  '0x7e5f4552091a69125d5dfcb7b8c2659029395bdf');

const selectors={
  vault:contracts.AccountRootBoundaryResearch.evm.methodIdentifiers,
  token:contracts.MockTokenResearch.evm.methodIdentifiers
};
const sel=(tag,name)=>{
  const found=Object.entries(selectors[tag])
    .filter(([s])=>s.startsWith(name+'('));
  assert.equal(found.length,1,name);
  return Buffer.from(found[0][1],'hex');
};

const names=[
  'root','totalStake','owner2','epoch2','credit2','stake2',
  'owner3','epoch3','credit3','stake3','liabilities','entered',
  'owner1','epoch1','credit1','stake1','mappingSlot16','poolDust'
];

const layout=contracts.AccountRootBoundaryResearch.storageLayout.storage;
assert.equal(layout.length,18);
for(let i=0;i<18;i++) {
  assert.equal(layout[i].slot,String(i));
  assert.equal(layout[i].offset,0);
  assert.equal(layout[i].label,i===16?'postNonces':names[i]);
}
const nonceKey=K(ABI([1n,16n]));
const domainType=KS(
  'EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)'
);
const postType=KS(
  'Post(uint256 accountId,uint256 epoch,uint256 nonce,uint256 validAfter,uint256 deadline,bytes32 stakeRoot,bytes32 textHash,uint256 fee,bytes32 profile)'
);
const profileHash=KS('CAW_C007_SYNTHETIC_POST_V1');
const F=5000n*10n**18n;
const BASE_TEXT=Buffer.from('one action','utf8');
const textHash=BigInt('0x'+hex(K(BASE_TEXT)));

function digest(r,chain=1n,to=VAULT,fee=F,prof=profileHash){
  const domain=K(Buffer.concat([
    domainType,KS('CAW C007 Synthetic Action'),KS('1'),
    W(chain),W(BigInt(to.toString()))
  ]));
  const body=K(Buffer.concat([postType,ABI(r),W(fee),prof]));
  return K(Buffer.concat([Buffer.from('1901','hex'),domain,body]));
}
function sign(r,key=key1,chain=1n,to=VAULT,fee=F,prof=profileHash){
  const rec=Buffer.from(secp256k1.sign(
    digest(r,chain,to,fee,prof),
    key,{prehash:false,format:'recovered'}
  ));
  assert.equal(rec.length,65);
  assert(rec[0]===0 || rec[0]===1);
  return Buffer.concat([rec.subarray(1),Buffer.from([27+rec[0]])]);
}
const request=(root,nonce=0n,epoch=0n)=>[
  1n,epoch,nonce,10n,20n,BigInt(root),textHash
];
function encode(r,sig,textBytes=BASE_TEXT){
  const paddedSig=Buffer.alloc(Math.ceil(sig.length/32)*32);
  const paddedText=Buffer.alloc(Math.ceil(textBytes.length/32)*32);
  sig.copy(paddedSig);
  textBytes.copy(paddedText);
  const sigTail=Buffer.concat([W(sig.length),paddedSig]);
  const textTail=Buffer.concat([W(textBytes.length),paddedText]);
  const textOffset=288+sigTail.length;
  return Buffer.concat([
    sel('vault','settleFixedPool1'),
    ABI([...r,288n,BigInt(textOffset)]),
    sigTail,textTail
  ]);
}
function reason(bytes){
  const h=hex(bytes);
  assert.equal(h.slice(0,8),'08c379a0');
  const n=Number(BigInt('0x'+h.slice(72,136)));
  return Buffer.from(h.slice(136,136+2*n),'hex').toString('utf8');
}
async function newFixture(name){
  const evm=await createEVM({
    common:new Common({chain:Mainnet,hardfork:Hardfork.Shanghai})
  });
  await evm.stateManager.putCode(VAULT,vaultCode);
  await evm.stateManager.putCode(TOKEN,tokenCode);

  const f=fixtures.fixtures[name];
  assert(f);
  for(let i=0;i<18;i++){
    await evm.stateManager.putStorage(
      VAULT,W(i),W(f.before[names[i]])
    );
  }
  const data=Buffer.concat([
    sel('token','mint'),
    ABI([BigInt(VAULT.toString()),BigInt(f.before.vaultBalance)])
  ]);
  const mint=(await evm.runCall({
    caller:RELAY,to:TOKEN,data,gasLimit:2000000n
  })).execResult;
  assert.equal(mint.exceptionError?.error??null,null);

  return {evm,f,name};
}
async function balance(x,to){
  const data=Buffer.concat([
    sel('token','balanceOf'),W(BigInt(to.toString()))
  ]);
  const r=(await x.evm.runCall({
    caller:RELAY,to:TOKEN,data,gasLimit:200000n
  })).execResult;
  assert.equal(r.exceptionError?.error??null,null);
  return BigInt('0x'+hex(r.returnValue)).toString();
}
async function snapshot(x){
  const s={};
  for(let i=0;i<18;i++){
    const b=await x.evm.stateManager.getStorage(VAULT,W(i));
    s[names[i]]=BigInt('0x'+(hex(b)||'0')).toString();
  }
  const nonce=await x.evm.stateManager.getStorage(VAULT,nonceKey);
  s.postNonce1=BigInt('0x'+(hex(nonce)||'0')).toString();
  s.vaultBalance=await balance(x,VAULT);
  s.walletA=await balance(x,A);
  s.walletB=await balance(x,B);
  return s;
}
function invariant(s,initialVault){
  const n=k=>BigInt(s[k]);
  assert.equal(
    n('liabilities'),
    n('credit1')+n('credit2')+n('credit3')
  );
  assert.equal(
    n('totalStake'),n('stake1')+n('stake2')+n('stake3')
  );
  assert.equal(
    n('vaultBalance'),n('liabilities')+n('poolDust')
  );
  for(let i=1;i<=3;i++) assert(n('stake'+i)<=n('credit'+i));
  assert.equal(s.entered,'0');
  assert.equal(
    n('walletA')+n('walletB')+n('vaultBalance'),
    BigInt(initialVault)
  );
}
function checkEvent(logs,r,f,nonce,textBytes){
  assert.equal(logs.length,2);
  const [from,topics,data]=logs[0];
  assert.equal(hex(from),VAULT.toString().slice(2).toLowerCase());
  assert.equal(hex(topics[0]),hex(KS(
    'ExperimentalFeeSettled(uint256,uint256,uint256,uint256,uint256,bytes32)'
  )));
  assert.equal(BigInt('0x'+hex(topics[1])),1n);
  assert.equal(BigInt('0x'+hex(topics[2])),nonce);
  assert.equal(data.length,128);
  const fields=[];
  for(let i=0;i<4;i++)fields.push(
    BigInt('0x'+hex(data.subarray(i*32,(i+1)*32)))
  );
  assert.equal(fields[0].toString(),f.allocation2);
  assert.equal(fields[1].toString(),f.allocation3);
  assert.equal(fields[2].toString(),f.newDust);
  assert.equal(fields[3],r[6]);

  const [textFrom,textTopics,encoded]=logs[1];
  assert.equal(hex(textFrom),hex(from));
  assert.equal(textTopics.length,3);
  assert.equal(
    hex(textTopics[0]),
    hex(KS('ExperimentalTextPublished(uint256,uint256,bytes)'))
  );
  assert.equal(hex(textTopics[1]),hex(topics[1]));
  assert.equal(hex(textTopics[2]),hex(topics[2]));

  assert.equal(encoded.length,64+Math.ceil(textBytes.length/32)*32);
  assert.equal(BigInt('0x'+hex(encoded.subarray(0,32))),32n);
  assert.equal(
    BigInt('0x'+hex(encoded.subarray(32,64))),
    BigInt(textBytes.length)
  );
  assert.deepEqual(
    Buffer.from(encoded.subarray(64,64+textBytes.length)),
    textBytes
  );
  assert(encoded.subarray(64+textBytes.length).every(b=>b===0));
  assert.equal(BigInt('0x'+hex(K(textBytes))),r[6]);

  return {
    emitterHex:hex(textFrom),
    topicsHex:textTopics.map(hex),
    dataHex:hex(encoded)
  };
}
const rows=[];
const withdrawalRows=[];
async function attempt(x,label,r,sig,expected='OK',timestamp=15n,textBytes=BASE_TEXT){
  const before=await snapshot(x);
  invariant(before,x.f.before.vaultBalance);
  const data=encode(r,sig,textBytes);

  const result=(await x.evm.runCall({
    caller:RELAY,to:VAULT,data,gasLimit:6000000n,
    block:{
      header:{
        number:0n,coinbase:RELAY,timestamp:BigInt(timestamp),
        difficulty:0n,prevRandao:new Uint8Array(32),
        gasLimit:30000000n,baseFeePerGas:undefined,
        slotNumber:0n,getBlobGasPrice:()=>undefined
      }
    }
  })).execResult;
  const error=result.exceptionError?.error??null;
  const after=await snapshot(x);
  invariant(after,x.f.before.vaultBalance);

  let textEvent=null;
  if(expected==='OK'){
    assert.equal(error,null,label);
    assert.deepEqual(after,x.f.after,label);
    textEvent=checkEvent(
      result.logs??[],r,x.f,
      BigInt(before.postNonce1),textBytes
    );
  }else{
    assert.equal(error,'revert',label);
    assert.equal(reason(result.returnValue),expected,label);
    assert.deepEqual(after,before,label+' ROLLBACK');
    assert.equal((result.logs??[]).length,0,label+' REVERT_LOGS');
  }

  rows.push({
    label,fixture:x.name,expected,error,
    before,after,calldataBytes:data.length,
    calldataSha256:sha(data),
    executionGas:result.executionGasUsed.toString(),
    eventValidated:expected==='OK',
    textEvent
  });
}
const main=await newFixture('main');
assert.deepEqual(await snapshot(main),main.f.before);
const r0=request(main.f.before.root);
const s0=sign(r0);

const readDigest=(await main.evm.runCall({
  caller:RELAY,to:VAULT,
  data:Buffer.concat([sel('vault','postDigest'),ABI(r0)]),
  gasLimit:500000n
})).execResult;
assert.equal(readDigest.exceptionError?.error??null,null);
assert.equal(hex(readDigest.returnValue),hex(digest(r0)));

await attempt(main,'wrong_signer',r0,sign(r0,key2),'SIGNER');
await attempt(main,'wrong_chain',r0,sign(r0,key1,31337n),'SIGNER');
await attempt(main,'wrong_contract',r0,sign(r0,key1,1n,OTHER),'SIGNER');
await attempt(main,'wrong_fee',r0,sign(r0,key1,1n,VAULT,F+1n),'SIGNER');
await attempt(main,'wrong_profile',r0,
  sign(r0,key1,1n,VAULT,F,KS('ALTERED_PROFILE')),'SIGNER');

const changedText=[...r0];
changedText[6]^=1n;
await attempt(main,'changed_text_hash',changedText,s0,'TEXT_HASH');
await attempt(main,'future_nonce',request(main.f.before.root,1n),
  sign(request(main.f.before.root,1n)),'NONCE');
await attempt(main,'wrong_epoch',request(main.f.before.root,0n,1n),
  sign(request(main.f.before.root,0n,1n)),'EPOCH');

const badV=Buffer.from(s0);
badV[64]=29;
await attempt(main,'bad_v',r0,badV,'SIG_V');
await attempt(main,'short_signature',r0,s0.subarray(0,64),'SIG_LEN');

const changedRoot=request(BigInt(main.f.before.root)^1n);
await attempt(main,'wrong_root',changedRoot,sign(changedRoot),'ROOT');

await attempt(main,'main_exact_floor',r0,s0);
await attempt(main,'replay',r0,s0,'NONCE');

async function runWithdrawal(label,id,caller,epoch,amount,expected='OK'){
  const before=await snapshot(main);
  invariant(before,main.f.before.vaultBalance);

  const data=Buffer.concat([
    sel('vault','withdraw'),
    ABI([BigInt(id),BigInt(epoch),BigInt(amount)])
  ]);
  assert.equal(data.length,100);

  const result=(await main.evm.runCall({
    caller,to:VAULT,data,gasLimit:6000000n
  })).execResult;

  const error=result.exceptionError?.error??null;
  const after=await snapshot(main);
  invariant(after,main.f.before.vaultBalance);

  if(expected==='OK'){
    assert.equal(error,null,label);

    const key='credit'+id;
    const n=k=>BigInt(after[k])-BigInt(before[k]);

    assert.equal(n(key),-BigInt(amount),label);
    assert.equal(n('liabilities'),-BigInt(amount),label);
    assert.equal(n('vaultBalance'),-BigInt(amount),label);

    const receiver=
      caller.toString().toLowerCase()===A.toString().toLowerCase()
        ? 'walletA':'walletB';
    const other=receiver==='walletA'?'walletB':'walletA';

    assert.equal(n(receiver),BigInt(amount),label);
    assert.equal(n(other),0n,label);

    for(let i=1;i<=3;i++)
      if(i!==id)assert.equal(
        after['credit'+i],before['credit'+i],label
      );
  }else{
    assert.equal(error,'revert',label);
    assert.equal(reason(result.returnValue),expected,label);
    assert.deepEqual(after,before,label+' ROLLBACK');
    assert.equal((result.logs??[]).length,0,label+' REVERT_LOGS');
  }

  for(const field of [
    'root','totalStake',
    'stake1','stake2','stake3',
    'owner1','owner2','owner3',
    'epoch1','epoch2','epoch3',
    'postNonce1','poolDust','entered','mappingSlot16'
  ]){
    assert.equal(after[field],before[field],label+' '+field);
  }

  withdrawalRows.push({
    label,accountId:id,caller:caller.toString(),
    epoch:String(epoch),amount:String(amount),
    expected,error,before,after,
    calldataBytes:data.length,
    calldataSha256:sha(data),
    executionGas:result.executionGasUsed.toString()
  });
}

const share2=BigInt(main.f.allocation2);
const share3=BigInt(main.f.allocation3);
const postState=await snapshot(main);

assert.deepEqual(postState,main.f.after);

// Independent adverse withdrawal controls.
await runWithdrawal(
  'withdraw2_wrong_owner',2,B,0n,share2,'OWNER'
);
await runWithdrawal(
  'withdraw2_stale_epoch',2,A,1n,share2,'EPOCH'
);
await runWithdrawal(
  'withdraw2_zero_amount',2,A,0n,0n,'AMOUNT'
);

const excess2=
  BigInt(postState.credit2)-BigInt(postState.stake2)+1n;

await runWithdrawal(
  'withdraw2_exceeds_unlocked',2,A,0n,
  excess2,'AVAILABLE_CREDIT'
);
await runWithdrawal(
  'withdraw3_wrong_owner',3,A,0n,share3,'OWNER'
);
await runWithdrawal(
  'withdraw1_payer_locked_excess',1,A,0n,
  1000n*10n**18n,'AVAILABLE_CREDIT'
);

// Withdraw exactly each newly earned reward.
await runWithdrawal(
  'withdraw2_A_reward',2,A,0n,share2
);
await runWithdrawal(
  'withdraw2_repeat_overdraw',2,A,0n,
  share2,'AVAILABLE_CREDIT'
);
await runWithdrawal(
  'withdraw3_B_reward',3,B,0n,share3
);
await runWithdrawal(
  'withdraw3_repeat_overdraw',3,B,0n,
  share3,'AVAILABLE_CREDIT'
);

assert.equal(withdrawalRows.length,10);
assert.equal(withdrawalRows.filter(x=>x.error===null).length,2);
assert.equal(
  withdrawalRows.filter(x=>x.error==='revert').length,8
);

const finalMain=await snapshot(main);
assert.equal(finalMain.credit1,String(1000n*10n**18n));
assert.equal(finalMain.credit2,String(10n*10n**18n));
assert.equal(finalMain.credit3,String(10n*10n**18n));
assert.equal(finalMain.poolDust,'1');
assert.equal(finalMain.postNonce1,'1');
assert.equal(finalMain.walletA,String(share2));
assert.equal(finalMain.walletB,String(share3));
assert.equal(
  finalMain.vaultBalance,
  String(1020n*10n**18n+1n)
);


const zero=await newFixture('zeroPool');
const rz=request(zero.f.before.root);
await attempt(zero,'zero_pool',rz,sign(rz),'NO_POOL');

const low=await newFixture('lowCredit');
const rl=request(low.f.before.root);
await attempt(low,'insufficient_unlocked_credit',rl,sign(rl),'CREDIT');

const stale=await newFixture('staleRoot');
await attempt(stale,'stale_committed_root',r0,s0,'ROOT');

const one=await newFixture('oneUnit');
const rOne=request(one.f.before.root);
const sOne=sign(rOne);
await attempt(one,'one_base_unit_pool',rOne,sOne);
await attempt(one,'one_unit_replay',rOne,sOne,'NONCE');

assert.equal(rows.length,18);
assert.equal(rows.filter(x=>x.error===null).length,2);
assert.equal(rows.filter(x=>x.error==='revert').length,16);


const windowRows=[];
const windowOracle=read(process.argv[5]);
assert.equal(
  windowOracle.schema,'caw-c007-signed-window-oracle/1'
);

for(const control of windowOracle.cases){
  const x=await newFixture('main');
  const r=request(x.f.before.root);
  r[3]=BigInt(control.validAfter);
  r[4]=BigInt(control.deadline);

  const original=request(x.f.before.root);
  const signature=control.signatureMode==='base'
    ?sign(original):sign(r);

  const countBefore=rows.length;
  await attempt(
    x,control.label,r,signature,
    control.expected,BigInt(control.timestamp)
  );
  assert.equal(rows.length,countBefore+1);

  const result=rows.pop();
  windowRows.push({
    ...result,
    blockTimestamp:String(control.timestamp),
    validAfter:String(control.validAfter),
    deadline:String(control.deadline),
    signatureMode:control.signatureMode
  });
}

assert.equal(windowRows.length,10);
assert.equal(
  windowRows.filter(x=>x.error===null).length,3
);
assert.equal(
  windowRows.filter(x=>x.error==='revert').length,7
);


const textOracle=read(process.argv[6]);
assert.equal(textOracle.schema,'caw-c007-text-vectors/1');
const textRows=[];

for(const vector of textOracle.cases){
  const x=await newFixture('main');
  const signed=Buffer.from(vector.signedHex,'hex');
  const submitted=Buffer.from(vector.submittedHex,'hex');
  const r=request(x.f.before.root);
  r[6]=BigInt('0x'+hex(K(signed)));

  const key=vector.signer===2?key2:key1;
  const beforeCount=rows.length;
  await attempt(
    x,vector.label,r,sign(r,key),
    vector.expected,15n,submitted
  );
  assert.equal(rows.length,beforeCount+1);

  const result=rows.pop();
  textRows.push({
    ...result,
    signedHex:vector.signedHex,
    submittedHex:vector.submittedHex,
    signedTextHashHex:hex(K(signed))
  });
}

assert.equal(textRows.length,9);
assert.equal(textRows.filter(x=>x.error===null).length,4);
assert.equal(textRows.filter(x=>x.error==='revert').length,5);


const utf8Oracle=read(process.argv[7]);
assert.equal(utf8Oracle.schema,'caw-c007-strict-utf8-vectors/1');
const utf8Rows=[];
for(const v of utf8Oracle.cases) {
  const raw=Buffer.from(v.hex,'hex');
  assert.equal(sha(raw),v.sha256);assert.equal(raw.length,v.bytes);
  const x=await newFixture('main');
  const r=request(x.f.before.root);r[6]=BigInt('0x'+hex(K(raw)));
  await attempt(x,'utf8_'+v.label,r,sign(r),v.expected,15n,raw);
  utf8Rows.push({...rows.pop(),inputHex:v.hex,oracleAccepted:v.accepted});
}
assert.equal(utf8Rows.length,22);

save('results.json',{
  schema:'caw-c007-utf8-scalar-evm/1',
  compilerReused:true,
  runtimeSha256:sha(vaultCode),
  tokenRuntimeSha256:sha(tokenCode),
  syntheticOwnerKey:1,
  syntheticMockMint:true,
  rootInjectedByHarness:true,
  accountAdmissionAuthenticated:false,
  realToken:false,
  signedTextPublished:true,
  strictUtf8Enforced:true,
  experimentalScalarLimit:420,
  normativeRuleAdopted:false,
  fixtureInputsDerivedFromRetainedRecords:true,
  utf8Cases:utf8Rows,
  validityWindowEnforced:true,
  realTransactions:false,
  populationScalable:false,
  cases:rows,
  withdrawals:withdrawalRows,
  windowCases:windowRows,
  textCases:textRows,
  mainFinalAfterWithdrawals:finalMain
});


console.log('PINNED_UTF8_RUNTIME=PASS');
console.log('SETTLEMENT=18_PASS WITHDRAWALS=10_PASS WINDOWS=10_PASS');
console.log('TEXT_REGRESSION=9_PASS EXPECTED_CHANGED=2');
console.log('UTF8_BOUNDARIES=22_PASS ACCEPTED='+utf8Rows.filter(x=>x.error===null).length);
console.log('REVERT_STATE_AND_LOGS=CHECKED EVENT_BYTES=EXACT');
console.log('NO_PUBLIC_TRANSACTIONS NO_REAL_CAW NO_POLICY_ADOPTION');
