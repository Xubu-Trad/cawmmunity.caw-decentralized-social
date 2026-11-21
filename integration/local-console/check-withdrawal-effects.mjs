import fs from 'node:fs';
import {verifyWithdrawalEffects} from './verify-withdrawal-effects.mjs';
const [evidence,selection]=process.argv.slice(2);
if(!evidence||!selection)throw Error('Usage: node check-withdrawal-effects.mjs evidence.json separately-selected-endpoints.json');
console.log(JSON.stringify(verifyWithdrawalEffects(JSON.parse(fs.readFileSync(evidence)),JSON.parse(fs.readFileSync(selection))),null,2));
