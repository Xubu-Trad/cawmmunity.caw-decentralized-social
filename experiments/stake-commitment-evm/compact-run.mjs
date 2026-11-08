// Compare representations only. Fresh in-memory EVM calls, no transactions/RPC.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import solc from 'solc';
import {Common,Hardfork,Mainnet} from '@ethereumjs/common';
import {createEVM} from '@ethereumjs/evm';
import {createAddressFromString} from '@ethereumjs/util';

const [vectorPath,output] = process.argv.slice(2);
assert(vectorPath && output && !fs.existsSync(output));
fs.mkdirSync(output);
const write=(n,x)=>fs.writeFileSync(`${output}/${n}`,JSON.stringify(x,null,2)+'\n',{flag:'wx'});
const vectors=JSON.parse(fs.readFileSync(vectorPath));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const word=n=>BigInt(n).toString(16).padStart(64,'0');
// Independently recompute each embedded empty hash rather than trusting vectors.
let h=sha(Buffer.from([0]));
const defaults=[];
for(let i=0;i<256;i++) {
  defaults.push(h);
  h=sha(Buffer.from('02'+h+word(0)+h+word(0),'hex'));
}
assert.deepEqual(vectors.defaults,defaults);
const contracts={};
for(const name of ['StakeProofResearch','CompactStakeProofResearch']) {
  const content=fs.readFileSync(new URL(`./${name}.sol`,import.meta.url),'utf8');
  if(name.startsWith('Compact')) assert(content.includes(`hex"${defaults.join('')}"`));
  const input={language:'Solidity',sources:{[name+'.sol']:{content}},settings:{
    optimizer:{enabled:true,runs:200},evmVersion:'shanghai',
    outputSelection:{'*':{'*':['evm.deployedBytecode.object','evm.methodIdentifiers']}}}};
  write(name+'-input.json',input);
  const built=JSON.parse(solc.compile(JSON.stringify(input)));
  write(name+'-output.json',built);
  assert(!(built.errors??[]).some(e=>e.severity==='error'),'compile failed');
  const c=built.contracts[name+'.sol'][name];
  assert.equal(Object.keys(c.evm.methodIdentifiers).length,1);
  const code=Buffer.from(c.evm.deployedBytecode.object,'hex');
  assert(code.length<=24576,'runtime code size');
  contracts[name]={code,selector:Object.values(c.evm.methodIdentifiers)[0]};
}
const compact=c=>[...c.header,word(c.bitmap),word(256),word(c.compact.length),...c.compact.flat()];
const full=c=>[...c.header,...c.siblings.flat()];
const results=[];
async function call(name,label,words,expected='true') {
  const evm=await createEVM({common:new Common({chain:Mainnet,hardfork:Hardfork.Shanghai})});
  const to=createAddressFromString('0x000000000000000000000000000000000000ca01');
  await evm.stateManager.putCode(to,contracts[name].code);
  const data=Buffer.from(contracts[name].selector+words.join(''),'hex');
  const {execResult:r}=await evm.runCall({to,data,gasLimit:2_000_000n});
  const ret=Buffer.from(r.returnValue).toString('hex');
  const intrinsic=21000n+[...data].reduce((n,b)=>n+(b===0?4n:16n),0n);
  const row={name,label,expected,exception:r.exceptionError?.error??null,returnHex:ret,
    calldataBytes:data.length,executionGas:String(r.executionGasUsed),
    calculatedIntrinsicGas:String(intrinsic),callPlusIntrinsic:String(intrinsic+r.executionGasUsed)};
  results.push(row); write(`case-${results.length}.json`,row);
  if(expected==='true') {assert.equal(row.exception,null);assert.equal(ret,word(1));}
  else {
    assert.equal(row.exception,'revert');
    if(expected==='abi') assert.equal(ret,'');
    else if(expected==='overflow') assert.equal(ret,'4e487b71'+word(17));
    else {
      assert.equal(ret.slice(0,8),'08c379a0');
      const n=Number(BigInt('0x'+ret.slice(72,136)));
      assert.equal(Buffer.from(ret.slice(136,136+n*2),'hex').toString(),expected);
    }
  }
}
for(const c of vectors.cases) {
  assert.equal(c.header.length,6); assert.equal(c.siblings.length,256);
  let used=0;
  for(let height=0;height<256;height++) {
    const pair=((BigInt(c.bitmap)>>BigInt(height))&1n)===1n
      ? c.compact[used++] : [defaults[height],word(0)];
    assert.deepEqual(pair,c.siblings[height]);
  }
  assert.equal(used,c.compact.length);
  await call('StakeProofResearch',c.label,full(c));
  await call('CompactStakeProofResearch',c.label,compact(c));
}
const name='CompactStakeProofResearch', base=vectors.cases[1];
async function changed(label,index,value,expected) {
  const words=compact(base);words[index]=value;await call(name,label,words,expected);
}
for(const [label,index] of [['namespace',0],['root',1],['account',3]])
  await changed(label,index,word(BigInt('0x'+base.header[index])^1n),'ROOT');
await changed('total',2,word(32),'TOTAL');
await changed('stake',4,word(8),'TOTAL');
await changed('presence',5,word(0),'ABSENT_STAKE');
await changed('abi_bool',5,word(2),'abi');
await changed('bitmap_add',6,word(BigInt(base.bitmap)|2n),'COUNT');
await changed('bitmap_remove',6,word(BigInt(base.bitmap)^1n),'COUNT');
await changed('hash',9,word(BigInt('0x'+base.compact[0][0])^1n),'ROOT');
await changed('sum',10,word(1),'TOTAL');
await changed('overflow',10,word(2n**256n-1n),'overflow');
await call(name,'truncated',compact(base).slice(0,-1),'abi');
const reversed=structuredClone(base);reversed.compact.reverse();
await call(name,'reordered',compact(reversed),'ROOT');
// One semantic representation change: explicitly carry a known default node.
const redundant=structuredClone(base);redundant.bitmap=String(BigInt(base.bitmap)|2n);
redundant.compact.splice(1,0,[defaults[1],word(0)]);
await call(name,'redundant_default',compact(redundant),'DEFAULT');
const unused=structuredClone(base);unused.compact.push([word(1),word(0)]);
await call(name,'unused_node',compact(unused),'COUNT');
const tooMany=structuredClone(vectors.cases[5]);tooMany.compact.push([word(1),word(0)]);
await call(name,'too_many_nodes',compact(tooMany),'COUNT');
write('results.json',{schema:'caw-compact-proof-evm/1',compiler:solc.version(),node:process.version,
  hardfork:'Shanghai',contracts:Object.fromEntries(Object.entries(contracts).map(([n,c])=>
    [n,{runtimeBytes:c.code.length,runtimeSha256:sha(c.code)}])),passed:results.length,cases:results,
  rootAuthenticated:false,transactionExecution:false,contractDeployment:false,
  settlementImplemented:false,fullSuiteRerun:false,productionAccepted:false});
console.log(`PASS: ${results.length} isolated calls; compact expansion matches all seven full proofs`);
