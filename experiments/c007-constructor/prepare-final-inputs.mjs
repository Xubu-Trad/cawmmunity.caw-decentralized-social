import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const [source,out]=process.argv.slice(2);assert(source&&out&&!fs.existsSync(out));fs.mkdirSync(out);
for(const n of ['acquired-history.json','compiler-output.json','final-proof-batches.json'])fs.copyFileSync(source+'/'+n,out+'/'+n);
const result=JSON.parse(fs.readFileSync(source+'/results.json'));
fs.writeFileSync(out+'/expected-final.json',JSON.stringify(result.final,null,2)+'\n');
const capture=JSON.parse(fs.readFileSync(out+'/acquired-history.json'));
const pins={firstHash:capture.blocks[1].block.hash,finalHash:capture.blocks.at(-1).block.hash,files:Object.fromEntries(['acquired-history.json','compiler-output.json','final-proof-batches.json','expected-final.json'].map(n=>[n,createHash('sha256').update(fs.readFileSync(out+'/'+n)).digest('hex')]))};
// Locally retained inputs, not an independently authenticated checkpoint.
fs.writeFileSync(out+'/input-pins.json',JSON.stringify(pins,null,2)+'\n');
