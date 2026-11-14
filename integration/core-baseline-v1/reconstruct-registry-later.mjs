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


const ra=new Interface(contracts.TestAccountRegistry.abi),ha=new Interface(contracts.RegistryHookResearch.abi),zero='0x'+'00'.repeat(20);
const runtimeInput=structuredClone(input);runtimeInput.settings.outputSelection={'*':{'*':['evm.deployedBytecode.object']}};
const registryRuntime=JSON.parse(solc.compile(JSON.stringify(runtimeInput))).contracts['FundedAdmissionResearch.sol'].TestAccountRegistry.evm.deployedBytecode.object;
const low=x=>x.toLowerCase(),sum=m=>[...m.values()].reduce((a,b)=>a+b,0n);
function reconstruct(ops){
 let s={balances:new Map(),allowance:0n,owners:new Map(),epochs:new Map(),approved:new Map(),operators:new Map(),budgets:new Map(),credits:new Map(),claimed:new Set(),nonce:0n,liability:0n,callback:zero,data:'0x',forward:false};
 let payer,token,registry,vault,root,hook;const nonces=new Map(),trace=[],failures=[];
 const event=(a,i,n,args)=>{const e=i.encodeEventLog(i.getEvent(n),args);return {address:a,topics:e.topics,data:e.data};};
 const get=a=>s.balances.get(a)??0n,owner=id=>s.owners.get(id),epoch=id=>s.epochs.get(id)??0n;
 const requireModel=(yes,reason)=>{if(!yes)throw new Error('MODEL:'+reason);};
 function transfer(caller,from,to,id,logs){
  requireModel(owner(id)===from,'WrongFrom');requireModel(to!==zero,'InvalidRecipient');
  requireModel(caller===from||s.approved.get(id)===caller||s.operators.get(from+':'+caller),'NotAuthorized');
  s.approved.set(id,zero);logs.push(event(registry,ra,'Approval',[from,zero,id]));
  s.owners.set(id,to);s.epochs.set(id,epoch(id)+1n);logs.push(event(registry,ra,'Transfer',[from,to,id]));
 }
 for(let index=0;index<ops.length;index++){
  const row=ops[index],tx=Transaction.from(row.rawTransaction);assert.equal(keccak256Hex(row.rawTransaction),row.hash);assert.equal(tx.hash,row.hash);
  assert.equal(tx.chainId,31337n);assert.equal(tx.value,0n);assert(tx.signature);
  const sender=inspectDigestSignature(tx.unsignedHash,tx.signature.serialized).from;assert.equal(sender,low(tx.from));
  assert.equal(tx.nonce,nonces.get(sender)??0);nonces.set(sender,tx.nonce+1);
  const before=structuredClone(s),logs=[];let failure=null;
  try{
   if(!tx.to){
    const address=low(getCreateAddress({from:sender,nonce:tx.nonce}));
    if(index===0){assert.equal(tx.data,'0x'+contracts.AdmissionTokenFixture.evm.bytecode.object);token=address;payer=sender;s.balances.set(payer,100n);}
    else if(index===1){
     const code='0x'+contracts.TestAccountRegistry.evm.bytecode.object;assert(tx.data.startsWith(code));const a=abi.decode(['address','address'],'0x'+tx.data.slice(code.length));assert.equal(tx.data,code+abi.encode(['address','address'],a).slice(2));registry=address;
     for(const id of [1n,2n,3n,4n]){const who=low(a[id===3n?1:0]);s.owners.set(id,who);s.epochs.set(id,0n);logs.push(event(registry,ra,'Transfer',[zero,who,id]));}
    }else if(index===2){
     const code='0x'+contracts.FundedAdmissionResearch.evm.bytecode.object;assert(tx.data.startsWith(code));const types=['address','address','bytes32','address','bytes32'],a=abi.decode(types,'0x'+tx.data.slice(code.length));assert.equal(tx.data,code+abi.encode(types,a).slice(2));
     assert.equal(low(a[0]),token);assert.equal(low(a[1]),payer);assert.equal(low(a[3]),registry);assert.equal(a[4],keccak256Hex('0x'+registryRuntime));root=a[2];vault=address;
    }else{assert(!hook);assert.equal(tx.data,'0x'+contracts.RegistryHookResearch.evm.bytecode.object);hook=address;}
   }else if(low(tx.to)===token){
    const c=ta.parseTransaction({data:tx.data});if(c.name==='approve'){assert.equal(sender,payer);assert.equal(low(c.args[0]),vault);s.allowance=c.args[1];}
    else{assert.equal(c.name,'setCallback');s.callback=low(c.args[0]);s.data=c.args[1];}
   }else if(low(tx.to)===registry){
    const c=ra.parseTransaction({data:tx.data}),a=c.args;
    if(c.name==='approve'){requireModel(sender===owner(a[1])||s.operators.get(owner(a[1])+':'+sender),'NotAuthorized');s.approved.set(a[1],low(a[0]));logs.push(event(registry,ra,'Approval',[owner(a[1]),a[0],a[1]]));}
    else if(c.name==='setApprovalForAll'){requireModel(sender!==low(a[0]),'InvalidOperator');s.operators.set(sender+':'+low(a[0]),a[1]);logs.push(event(registry,ra,'ApprovalForAll',[sender,a[0],a[1]]));}
    else{assert(['transferFrom','safeTransferFrom'].includes(c.name));transfer(sender,low(a[0]),low(a[1]),a[2],logs);
     if(c.name==='safeTransferFrom'){assert.equal(low(a[1]),hook);requireModel(s.forward,'UnsafeRecipient');transfer(hook,hook,low(a[0]),a[2],logs);}
    }
   }else if(low(tx.to)===hook){const c=ha.parseTransaction({data:tx.data});assert.equal(c.name,'setForward');s.forward=c.args[0];}
   else{
    assert.equal(low(tx.to),vault);const c=fa.parseTransaction({data:tx.data}),a=c.args;
    if(c.name==='admit'){
     requireModel(sender===payer,'PAYER');requireModel(a[0]===s.nonce,'NONCE');requireModel(get(payer)>=5n&&s.allowance>=5n,'FUNDS');
     const id=recordId(vault,root,a[0]);assert(!s.budgets.has(id));s.balances.set(payer,get(payer)-5n);s.balances.set(vault,get(vault)+5n);s.allowance-=5n;s.budgets.set(id,5n);s.nonce++;s.liability+=5n;
     logs.push(event(vault,fa,'ResearchFeeAdmitted',[id,1,0,a[0],5,root,10,2,'0x'+'33'.repeat(32)]));
    }else if(c.name==='claim'){
     const [n,id,weight,hs,ss,ph,ps]=a,key=recordId(vault,root,n),marker=key+':'+id;
     requireModel(n<s.nonce&&id!==1n&&!s.claimed.has(marker),'CLAIM');proofPrefix(root,1n,2n,ph,ps);const start=proofPrefix(root,id,weight,hs,ss)-(id>1n?2n:0n),amount=5n*(start+weight)/8n-5n*start/8n;
     requireModel(start>=0n&&amount<=s.budgets.get(key),'BUDGET');s.budgets.set(key,s.budgets.get(key)-amount);s.credits.set(id,(s.credits.get(id)??0n)+amount);s.claimed.add(marker);logs.push(event(vault,fa,'ResearchFeeClaimed',[key,id,amount]));
    }else{
     assert.equal(c.name,'withdraw');const [id,e,amount]=a;requireModel(id>=2n&&id<=4n,'ACCOUNT');requireModel(owner(id)===sender,'OWNER');requireModel(epoch(id)===e,'EPOCH');requireModel(amount>0n&&amount<=(s.credits.get(id)??0n),'CREDIT');
     s.credits.set(id,s.credits.get(id)-amount);s.liability-=amount;s.balances.set(vault,get(vault)-amount);s.balances.set(sender,get(sender)+amount);
     if(s.callback!==zero){
      // Model low-level callback failure independently: failed nested calls roll back,
      // but the test token ignores their success flag and continues its transfer.
      const nestedBefore=structuredClone(s),nlogs=[];
      try{if(s.callback===registry){const n=ra.parseTransaction({data:s.data});assert.equal(n.name,'transferFrom');transfer(token,low(n.args[0]),low(n.args[1]),n.args[2],nlogs);}
       else{assert.equal(s.callback,hook);const n=ha.parseTransaction({data:s.data});assert.equal(n.name,'cycle');assert.equal(low(n.args[0]),registry);transfer(hook,low(n.args[1]),hook,n.args[2],nlogs);transfer(hook,hook,low(n.args[1]),n.args[2],nlogs);}
       logs.push(...nlogs);
      }catch(e){if(!e.message.startsWith('MODEL:'))throw e;s=nestedBefore;}
     }
     requireModel(owner(id)===sender&&epoch(id)===e,'AUTHORITY_CHANGED');logs.push(event(vault,fa,'ResearchWithdrawal',[id,sender,e,amount]));
    }
   }
  }catch(e){if(!e.message.startsWith('MODEL:'))throw e;failure=e.message.slice(6);s=before;logs.length=0;}
  assert.equal(row.status,failure?0:1);assert.deepEqual(row.logs,logs);if(failure)failures.push({index,reason:failure});
  assert.equal(sum(s.budgets)+sum(s.credits),s.liability);assert.equal(sum(s.balances),100n);assert(get(vault)>=s.liability);
  trace.push({index,hash:row.hash,status:row.status,owner:owner(2n),epoch:epoch(2n).toString(),vault:get(vault).toString(),credit:(s.credits.get(2n)??0n).toString(),liability:s.liability.toString()});
 }
 const final={payer:get(payer).toString(),vault:get(vault).toString(),allowance:s.allowance.toString(),nonce:s.nonce.toString(),liability:s.liability.toString(),nextBudget:(s.budgets.get(recordId(vault,root,s.nonce))??0n).toString(),credit:(s.credits.get(2n)??0n).toString(),owner:owner(2n),epoch:epoch(2n).toString(),other:get(owner(2n)).toString(),credited:sum(s.credits).toString(),unallocated:sum(s.budgets).toString(),approved:s.approved.get(2n)??zero,ownerBalance:[...s.owners.values()].filter(x=>x===owner(2n)).length.toString()};
 return {final,trace,failures,registryState:{owners:Object.fromEntries(s.owners),epochs:Object.fromEntries([...s.epochs].map(([k,v])=>[k,v.toString()])),approved:Object.fromEntries(s.approved),operators:Object.fromEntries(s.operators)}};
}
const result=reconstruct(observations),want=structuredClone(expected.final);want.owner=low(want.owner);assert.deepEqual(result.final,want);
const rejected=[];
for(const [name,mutate] of [
 ['missing operation',x=>x.splice(8,1)],['duplicate operation',x=>x.splice(9,0,structuredClone(x[8]))],
 ['changed hash',x=>x[5].hash='0x'+'00'.repeat(32)],
 ['missing registry mint log',x=>x[1].logs.pop()],
 ['withdrawal amount altered',x=>x.at(-1).logs[0].data=abi.encode(['uint256','uint256'],[3,3])],
 ['forwarding event omitted',x=>{const i=x.findIndex(r=>r.logs.length===4);assert(i>=0);x[i].logs.pop();}],
 ['revert labelled success',x=>x[x.findIndex(r=>r.status===0)].status=1],
 ['ownership event altered',x=>{const r=x.find(r=>r.logs.length===2);r.logs[1].topics[2]='0x'+'00'.repeat(12)+'44'.repeat(20);}]
]){const x=structuredClone(observations);mutate(x);assert.throws(()=>reconstruct(x));rejected.push(name);}
console.log(JSON.stringify({status:'RECONSTRUCTED_REGISTRY_WITHDRAWALS',transactions:observations.length,rejected,...result,limits:'Separate state model, not EVM execution. Signed bytes and all predicted logs checked; no gas model or public-chain authentication. Nested callbacks modeled from supplied test-helper code.'},null,2));
