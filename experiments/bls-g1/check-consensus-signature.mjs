import fs from 'node:fs';
import assert from 'node:assert/strict';
import {deriveSigningContext} from '../signing-domain/signing-domain.mjs';
import {inspectPopAggregateEquation} from './aggregate.mjs';
const x=JSON.parse(fs.readFileSync(process.argv[2]));
const b=s=>Buffer.from(s.slice(2),'hex');
const run=(t=x.domainType,v=x.forkVersion,g=x.genesisValidatorsRoot,o=x.objectRoot)=>{
 const context=deriveSigningContext(t,v,g,o);
 return {context,equation:inspectPopAggregateEquation(x.publicKeys.map(b),b(context.signingRoot),b(x.signature))};
};
const valid=run();assert(valid.equation.aggregateEquationVerified);assert.equal(valid.equation.updatesAccepted,false);
const negatives=[];
for(const [name,args]of [['domain',['0x08000000']],['fork',[x.domainType,'0x04000001']],['genesis',[x.domainType,x.forkVersion,'0x'+'00'.repeat(32)]],['message',[x.domainType,x.forkVersion,x.genesisValidatorsRoot,'0x'+'00'.repeat(32)]]]){assert.throws(()=>run(...args));negatives.push(name);}
assert.throws(()=>inspectPopAggregateEquation(x.publicKeys.slice(1).map(b),b(valid.context.signingRoot),b(x.signature)));negatives.push('missing participant');
console.log(JSON.stringify({officialFixtureEquationVerified:true,context:valid.context,participants:x.publicKeys.length,negativeControls:negatives,committeeAuthenticated:false,fullUpdateValidated:false,finalityVerified:false,productionAccepted:false},null,2));
