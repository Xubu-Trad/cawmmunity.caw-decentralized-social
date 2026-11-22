// Separate mock accounting model over saved local execution observations.
import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import solc from 'solc';
import {Transaction,Interface,AbiCoder,getCreateAddress,version} from 'ethers';
import {inspectDigestSignature} from '../../reference/ethereum-block-senders.mjs';
import {keccak256Hex} from '../../reference/keccak256.mjs';
import {decodeCandidateLog} from './c007-claim-event-codec.mjs';
import {bindCandidateAdmission} from './c007-admission-binding.mjs';
const [directory,pinsPath]=process.argv.slice(2),pins=JSON.parse(fs.readFileSync(pinsPath));
function read(name){const raw=fs.readFileSync(directory+'/'+name);assert.equal(createHash('sha256').update(raw).digest('hex'),pins.files[name]);return JSON.parse(raw);}
assert.equal(version,'6.16.0');assert.equal(solc.version(),'0.8.30+commit.73712a01.Emscripten.clang');
const input=read('compiler-input.json'),observations=read('operations.json'),expected=read('result.json');
const compiled=JSON.parse(solc.compile(JSON.stringify(input)));assert(!(compiled.errors??[]).some(x=>x.severity==='error'));
const contracts=compiled.contracts['FundedAdmissionResearch.sol'],ta=new Interface(contracts.AdmissionTokenFixture.abi),fa=new Interface(contracts.FundedAdmissionResearch.abi),abi=AbiCoder.defaultAbiCoder();

const max=(1n<<256n)-1n;
const word=n=>{assert(n>=0n&&n<=max);return Buffer.from(n.toString(16).padStart(64,'0'),'hex');};
const bytes=h=>Buffer.from(h.slice(2),'hex'),hash=b=>createHash('sha256').update(b).digest();
function proofPrefix(root,account,weight,hashes,sums){
 if(hashes.length!==256||sums.length!==256)throw new Error('PROOF_LENGTH');
 let node=hash(Buffer.concat([Buffer.from([1]),word(account),word(weight)])),total=weight,prefix=0n;
 for(let h=0;h<256;h++){
  const sibling=sums[h];
  if((account>>BigInt(h))&1n){prefix+=sibling;node=hash(Buffer.concat([Buffer.from([2]),bytes(hashes[h]),word(sibling),node,word(total)]));}
  else node=hash(Buffer.concat([Buffer.from([2]),node,word(total),bytes(hashes[h]),word(sibling)]));
  total+=sibling;word(total);
 }
 if(total!==10n)throw new Error('TOTAL');
 const wrapped='0x'+hash(Buffer.concat([Buffer.from('CAW_STAKE_TREE_RESEARCH_V1\0'),Buffer.alloc(32,0x11),node,word(total)])).toString('hex');
 if(wrapped!==root)throw new Error('ROOT');return prefix;
}
function recordId(vault,root,nonce){return '0x'+hash(Buffer.concat([Buffer.from('CAW_C007_CLAIM_RECORD_RESEARCH_V1\0'),word(31337n),bytes(vault),Buffer.alloc(32,0x33),word(1n),word(0n),word(nonce),word(5n),bytes(root),word(10n)])).toString('hex');}

function reconstruct(ops){
 const balances=new Map(),allowances=new Map(),txNonces=new Map(),budgets=new Map();const trace=[],reasons=[],claimReasons=[],claimRows=[];const credits=new Map(),claimed=new Set();
 let token,payer,vault,root,outsider,mode=false,nonce=0n,liability=0n;
 const get=a=>balances.get(a)??0n,key=(a,b)=>a+':'+b;
 for(let index=0;index<ops.length;index++){
  const row=ops[index],tx=Transaction.from(row.rawTransaction);
  assert.equal(keccak256Hex(row.rawTransaction),row.hash);assert.equal(tx.hash,row.hash);
  assert.equal(tx.chainId,31337n);assert.equal(tx.value,0n);assert(tx.signature);
  const recovered=inspectDigestSignature(tx.unsignedHash,tx.signature.serialized).from;
  assert.equal(recovered,tx.from.toLowerCase());const sender=recovered;
  assert.equal(tx.nonce,txNonces.get(sender)??0);txNonces.set(sender,tx.nonce+1);
  assert(row.status===0||row.status===1);assert(Array.isArray(row.logs));
  if(index===0){
   assert.equal(tx.to,null);assert.equal(row.status,1);assert.equal(row.logs.length,0);
   assert.equal(tx.data,'0x'+contracts.AdmissionTokenFixture.evm.bytecode.object);
   token=getCreateAddress({from:sender,nonce:tx.nonce}).toLowerCase();payer=sender;balances.set(payer,100n);
  }else if(index===1){
   assert.equal(tx.to,null);assert.equal(row.status,1);assert.equal(row.logs.length,0);
   const code='0x'+contracts.FundedAdmissionResearch.evm.bytecode.object;assert(tx.data.startsWith(code));
   const args=abi.decode(['address','address','bytes32'],'0x'+tx.data.slice(code.length));
   assert.equal(tx.data,code+abi.encode(['address','address','bytes32'],args).slice(2));assert.equal(args[0].toLowerCase(),token);assert.equal(args[1].toLowerCase(),payer);
   root=args[2];vault=getCreateAddress({from:sender,nonce:tx.nonce}).toLowerCase();
  }else if(tx.to?.toLowerCase()===token){
   const call=ta.parseTransaction({data:tx.data,value:tx.value});assert(call);assert.equal(row.status,1);assert.equal(row.logs.length,0);
   if(call.name==='approve')allowances.set(key(sender,call.args[0].toLowerCase()),call.args[1]);
   else if(call.name==='setReturnFalse')mode=call.args[0];
   else if(call.name==='transfer'){const to=call.args[0].toLowerCase(),amount=call.args[1];assert(get(sender)>=amount);balances.set(sender,get(sender)-amount);balances.set(to,get(to)+amount);outsider=to;}
   else assert.fail('unsupported token call');
  }else{
   assert.equal(tx.to?.toLowerCase(),vault);const call=fa.parseTransaction({data:tx.data,value:tx.value});assert(call);
   if(call.name==='claim'){
    const [n,account,weight,hashes,sums,payerHashes,payerSums]=call.args,id=recordId(vault,root,n),marker=id+':'+account;
    let failure=null,amount;
    if(n>=nonce)failure='UNKNOWN_RECORD';else if(account===1n)failure='PAYER';else if(claimed.has(marker))failure='CLAIMED';
    else try{
     proofPrefix(root,1n,2n,payerHashes,payerSums);const prefix=proofPrefix(root,account,weight,hashes,sums),start=prefix-(account>1n?2n:0n);assert(start>=0n);
     amount=5n*(start+weight)/8n-5n*start/8n;
     if(amount>(budgets.get(id)??0n))failure='BUDGET';
    }catch(e){if(!['PROOF_LENGTH','TOTAL','ROOT'].includes(e.message))throw e;failure=e.message;}
    if(failure){assert.equal(row.status,0);assert.equal(row.logs.length,0);claimReasons.push(failure);}
    else{
     assert.equal(row.status,1);assert.equal(row.logs.length,1);const event=decodeCandidateLog(row.logs[0],vault);
     assert.equal(event.kind,'claim');assert.equal(event.recordId,id);assert.equal(event.accountId,account.toString());assert.equal(event.amount,amount.toString());
     assert(budgets.has(id));budgets.set(id,budgets.get(id)-amount);claimed.add(marker);credits.set(account,(credits.get(account)??0n)+amount);
     claimRows.push({recordId:id,nonce:n.toString(),account:account.toString(),weight:weight.toString(),amount:amount.toString()});
    }
   }else{
   assert.equal(call.name,'admit');
   const supplied=call.args[0],allowance=allowances.get(key(payer,vault))??0n;
   const failure=sender!==payer?'PAYER':supplied!==nonce?'NONCE':get(payer)<5n?'FUNDS':allowance<5n?'ALLOWANCE':mode?'TOKEN_FALSE':null;
   if(failure){assert.equal(row.status,0);assert.equal(row.logs.length,0);reasons.push(failure);}
   else{
    assert.equal(row.status,1);assert.equal(row.logs.length,1);
    const event=bindCandidateAdmission(row.logs[0],{chainId:'31337',emitter:vault,profile:'0x'+'33'.repeat(32)});
    assert.equal(event.payerAccount,'1');assert.equal(event.epoch,'0');assert.equal(event.nonce,nonce.toString());assert.equal(event.fee,'5');assert.equal(event.stakeRoot,root);assert.equal(event.totalStake,'10');assert.equal(event.payerStake,'2');assert(!budgets.has(event.recordId));
    balances.set(payer,get(payer)-5n);balances.set(vault,get(vault)+5n);allowances.set(key(payer,vault),allowance-5n);budgets.set(event.recordId,5n);nonce++;liability+=5n;
   }
  }
  }
  assert.equal([...budgets.values()].reduce((a,b)=>a+b,0n)+[...credits.values()].reduce((a,b)=>a+b,0n),liability);
  assert.equal([...balances.values()].reduce((a,b)=>a+b,0n),100n);assert(get(vault)>=liability);
  trace.push({index,transactionHash:row.hash,status:row.status,payerBalance:get(payer).toString(),vaultBalance:get(vault).toString(),nonce:nonce.toString(),liability:liability.toString(),budgets:budgets.size});
 }
 const word=n=>Buffer.from(BigInt(n).toString(16).padStart(64,'0'),'hex');
 const nextId='0x'+createHash('sha256').update(Buffer.concat([Buffer.from('CAW_C007_CLAIM_RECORD_RESEARCH_V1\0'),word(31337),Buffer.from(vault.slice(2),'hex'),Buffer.alloc(32,0x33),word(1),word(0),word(nonce),word(5),Buffer.from(root.slice(2),'hex'),word(10)])).digest('hex');
 return {trace,reasons,claimReasons,claimRows,credits:Object.fromEntries([...credits].map(([k,v])=>[k.toString(),v.toString()])),markers:claimed.size,budgets:Object.fromEntries([...budgets].map(([k,v])=>[k,v.toString()])),final:{payer:get(payer).toString(),vault:get(vault).toString(),allowance:(allowances.get(key(payer,vault))??0n).toString(),nonce:nonce.toString(),liability:liability.toString(),nextBudget:(budgets.get(nextId)??0n).toString()},outsiderMockBalance:get(outsider).toString()};
}
const result=reconstruct(observations);assert.deepEqual(result.final,expected.final);assert.equal(result.outsiderMockBalance,expected.outsiderMockBalance);assert.deepEqual(Object.keys(result.budgets),expected.recordIds);assert.deepEqual(Object.values(result.budgets),expected.remainingBudgets);assert.deepEqual(['2','3','4'].map(k=>result.credits[k]),expected.finalCredits);assert.equal(result.markers,6);assert.deepEqual(result.claimReasons,['UNKNOWN_RECORD','PAYER','TOTAL','ROOT','ROOT','PROOF_LENGTH','CLAIMED','CLAIMED']);assert.deepEqual(result.reasons,['ALLOWANCE','ALLOWANCE','NONCE','TOKEN_FALSE','PAYER','FUNDS']);
const admitted=observations.findIndex(x=>x.logs.length===1),failed=observations.findIndex(x=>x.status===0),rejected=[];
for(const [name,mutate]of [
 ['duplicate operation',x=>x.splice(admitted+1,0,structuredClone(x[admitted]))],
 ['missing admission operation',x=>x.splice(admitted,1)],
 ['false success on failed payment',x=>x[failed].status=1],
 ['log on reverted payment',x=>x[failed].logs=structuredClone(x[admitted].logs)],
 ['missing admitted event',x=>x[admitted].logs=[]],
 ['wrong emitter',x=>x[admitted].logs[0].address='0x'+'44'.repeat(20)],
 ['changed transaction hash label',x=>x[admitted].hash='0x'+'00'.repeat(32)]
]){const x=structuredClone(observations);mutate(x);assert.throws(()=>reconstruct(x));rejected.push(name);}
const claimIndex=observations.findIndex(x=>x.logs[0]&&decodeCandidateLog(x.logs[0],x.logs[0].address).kind==='claim');
for(const [name,mutate]of [
 ['missing claim',x=>x.splice(claimIndex,1)],
 ['duplicate signed claim',x=>x.splice(claimIndex+1,0,structuredClone(x[claimIndex]))],
 ['claim amount changed',x=>x[claimIndex].logs[0].data='0x'+'0'.repeat(63)+'2'],
 ['claim redirected',x=>x[claimIndex].logs[0].topics[2]='0x'+'0'.repeat(63)+'3'],
 ['claim record changed',x=>x[claimIndex].logs[0].topics[1]='0x'+'11'.repeat(32)],
 ['claim event missing',x=>x[claimIndex].logs=[]]
]){const x=structuredClone(observations);mutate(x);assert.throws(()=>reconstruct(x));rejected.push(name);}
console.log(JSON.stringify({status:'RECONSTRUCTED_LOCAL_FUNDED_CLAIMS',transactions:observations.length,rejected,...result,
 limits:'Separate accounting model and existing signature reader over hash-pinned local observations; no receipt/header authentication, native gas reconstruction, independent EVM replay or actual CAW proof.'},null,2));
