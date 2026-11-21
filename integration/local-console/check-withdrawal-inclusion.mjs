import { readJsonFile } from './read-proof-file.mjs';
import { BOUNDED_JSON_LIMITS } from '../../public/bounded-json.mjs';
import { verifyWalletWithdrawalInclusion } from './withdrawal-inclusion.mjs';

if (process.argv.length !== 4) throw Error('Usage: node check-withdrawal-inclusion.mjs block.json pins.json');
const block = readJsonFile(process.argv[2], BOUNDED_JSON_LIMITS.maxBytes);
const pins = readJsonFile(process.argv[3], 65536);
console.log(JSON.stringify(verifyWalletWithdrawalInclusion(block,pins),null,2));
