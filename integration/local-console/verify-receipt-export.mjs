import fs from 'node:fs';
import {verifyReceiptExport} from './ui/receipt-export.mjs';
try{
 if(process.argv.length!==4)throw Error('Usage: node verify-receipt-export.mjs export.json independently-selected-state.json');
 for(const p of process.argv.slice(2))if(fs.statSync(p).size>200000)throw Error('Input exceeds 200000 bytes.');
 const input=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));
 const {value,...result}=await verifyReceiptExport(fs.readFileSync(process.argv[2],'utf8'),input.before??input);
 console.log(JSON.stringify({...result,limits:'Editable local observations only. No chain query, receipt inclusion, finality or independent execution verified.'},null,2));
}catch(e){console.error(e.message);process.exitCode=1;}
