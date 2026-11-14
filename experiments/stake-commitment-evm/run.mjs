// Local bytecode calls only. No RPC, signing, deployed chain or transaction receipts.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import solc from 'solc';
import { Common, Hardfork, Mainnet } from '@ethereumjs/common';
import { createEVM } from '@ethereumjs/evm';
import { createAddressFromString } from '@ethereumjs/util';

const [vectorsPath, output] = process.argv.slice(2);
assert(vectorsPath && output && !fs.existsSync(output), 'new output directory required');
fs.mkdirSync(output, {recursive:false});
const write = (name, value) => fs.writeFileSync(`${output}/${name}`, JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const source = fs.readFileSync(new URL('./StakeProofResearch.sol',import.meta.url),'utf8');
const input = {language:'Solidity', sources:{'StakeProofResearch.sol':{content:source}},
  settings:{optimizer:{enabled:true,runs:200},evmVersion:'shanghai',
    outputSelection:{'*':{'*':['abi','evm.deployedBytecode.object','evm.methodIdentifiers']}}}};
write('compiler-input.json',input);
const compiled = JSON.parse(solc.compile(JSON.stringify(input)));
write('compiler-output.json',compiled);
assert(!(compiled.errors ?? []).some(x=>x.severity==='error'), 'compiler error, retained output');
const contract = compiled.contracts['StakeProofResearch.sol'].StakeProofResearch;
const selector = Object.values(contract.evm.methodIdentifiers)[0];
assert.equal(Object.keys(contract.evm.methodIdentifiers).length,1);
const code = Buffer.from(contract.evm.deployedBytecode.object,'hex');
const vectors = JSON.parse(fs.readFileSync(vectorsPath));
const cases = vectors.cases.map((c,i)=>({label:`positive_${i}`,words:c.words,expected:'true'}));
const base = vectors.cases[1].words;
const word = n=>BigInt(n).toString(16).padStart(64,'0');
function changed(label, index, value, expected='ROOT') {
  const words = [...base]; words[index]=value;
  cases.push({label,words,expected});
}
for (const [label,index] of [['namespace',0],['root',1],['account',3]])
  changed(label,index,word(BigInt('0x'+base[index])^1n));
changed('total',2,word(32),'TOTAL');
changed('stake',4,word(8),'TOTAL');
changed('presence',5,word(0),'ABSENT_STAKE');
changed('invalid_bool',5,word(2),'abi');
for (const height of [0,1,31,63,127,191,254,255]) {
  const index = 6+2*height;
  changed(`sibling_hash_${height}`,index,word(BigInt('0x'+base[index])^1n));
}
changed('sibling_sum',7,word(BigInt('0x'+base[7])+1n),'TOTAL');
changed('overflow',7,word(2n**256n-1n),'overflow');
cases.push({label:'truncated_proof',words:base.slice(0,-1),expected:'abi'});
const results=[];
for (const c of cases) {
  const evm = await createEVM({common:new Common({chain:Mainnet,hardfork:Hardfork.Shanghai})});
  const to = createAddressFromString('0x000000000000000000000000000000000000ca01');
  await evm.stateManager.putCode(to,code);
  const data=Buffer.from(selector+c.words.join(''),'hex');
  const {execResult:r}=await evm.runCall({to,data,gasLimit:2_000_000n});
  const returned=Buffer.from(r.returnValue).toString('hex');
  const row={label:c.label,expected:c.expected,exception:r.exceptionError?.error ?? null,
    returnHex:returned,executionGas:r.executionGasUsed.toString(),calldataBytes:data.length,
    shanghaiIntrinsicGas:(21000n+[...data].reduce((n,b)=>n+(b===0?4n:16n),0n)).toString()};
  results.push(row); write(`case-${c.label}.json`,row);
  if(c.expected==='true') {assert.equal(row.exception,null); assert.equal(returned,word(1));}
  else {
    assert.equal(row.exception,'revert');
    if(c.expected==='abi') assert.equal(returned,'');
    else if(c.expected==='overflow') assert.equal(returned,'4e487b71'+word(17));
    else {
      assert.equal(returned.slice(0,8),'08c379a0');
      const length=Number(BigInt('0x'+returned.slice(72,136)));
      assert.equal(Buffer.from(returned.slice(136,136+2*length),'hex').toString(),c.expected);
    }
  }
}
write('results.json',{schema:'caw-stake-proof-evm/1',compiler:solc.version(),node:process.version,
  hardfork:'Shanghai',runtimeBytes:code.length,runtimeSha256:crypto.createHash('sha256').update(code).digest('hex'),
  cases:results,passed:results.length,transactionExecution:false,contractDeployment:false,
  rootAuthenticated:false,settlementImplemented:false,fullSuiteRerun:false,productionAccepted:false});
console.log(`PASS: ${results.length} isolated bytecode calls, no transactions/deployment`);
