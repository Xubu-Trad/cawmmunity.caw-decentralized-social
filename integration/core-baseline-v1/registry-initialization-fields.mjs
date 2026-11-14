import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import solc from 'solc';import {keccak256,AbiCoder} from 'ethers';
export function registryInitializationFields(inputBytes,m){
 assert.equal(createHash('sha256').update(inputBytes).digest('hex'),m.compilerInputSha256);assert.equal(solc.version(),m.compiler);
 const input=JSON.parse(inputBytes);input.settings.outputSelection={'*':{'*':['storageLayout','evm.deployedBytecode.object']}};
 const output=JSON.parse(solc.compile(JSON.stringify(input)));assert(!(output.errors??[]).some(e=>e.severity==='error'));const a=output.contracts[m.sourceKey][m.contract];assert.equal(keccak256('0x'+a.evm.deployedBytecode.object),m.runtimeHash);
 const layout=a.storageLayout;assert.equal(layout.storage.length,5);
 const slot=label=>{const x=layout.storage.find(x=>x.label===label);assert(x&&x.offset===0);assert.equal(layout.types[x.type].encoding,'mapping');return BigInt(x.slot);};
 const abi=AbiCoder.defaultAbiCoder(),mapping=(type,key,s)=>keccak256(abi.encode([type,'uint256'],[key,s]));
 const initial=[m.initialOwners[0],m.initialOwners[0],m.initialOwners[1],m.initialOwners[0]].map(x=>x.toLowerCase()),fields=[];
 for(let id=1;id<=4;id++){
  fields.push({label:'owner'+id,key:mapping('uint256',id,slot('owners')),expected:BigInt(initial[id-1]).toString()});
  for(const label of ['epochs','approved'])fields.push({label:label+id,key:mapping('uint256',id,slot(label)),expected:'0'});
 }
 // Explicit test probe address, not a claim about every possible operator.
 const probes=[...new Set([...initial,'0x1eff47bc3a10a45d4b230b5d10e37751fe6aa718'])];assert.equal(probes.length,2,'FIXTURE_SCOPE');
 for(const who of probes)fields.push({label:'balance:'+who,key:mapping('address',who,slot('balances')),expected:String(initial.filter(x=>x===who).length)});
 for(const [owner,operator]of [[probes[0],probes[1]],[probes[1],probes[0]]])fields.push({label:'operator:'+owner+':'+operator,key:mapping('address',operator,BigInt(mapping('address',owner,slot('operators')))),expected:'0'});
 assert.equal(fields.length,16);assert.equal(new Set(fields.map(f=>f.key)).size,16);return fields;
}
