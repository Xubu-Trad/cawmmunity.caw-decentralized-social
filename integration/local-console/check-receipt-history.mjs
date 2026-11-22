import fs from 'node:fs';import {verifyReceiptHistory} from './verify-receipt-history.mjs';
function load(p,max){if(fs.statSync(p).size>max)throw Error('Input exceeds size limit.');return fs.readFileSync(p,'utf8');}
try{
 if(process.argv.length!==6)throw Error('Usage: node check-receipt-history.mjs export.json state.json capture.json selection.json');
 const [e,s,b,c]=process.argv.slice(2),state=JSON.parse(load(s,200000));
 console.log(JSON.stringify(await verifyReceiptHistory(load(e,200000),state.before??state,JSON.parse(load(b,8*1024*1024)),JSON.parse(load(c,200000))),null,2));
}catch(e){console.error('NOT_ACCEPTED: '+e.message);process.exitCode=1;}
