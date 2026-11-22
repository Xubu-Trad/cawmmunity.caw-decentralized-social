import { keccak256 } from 'ethers';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const hex = (v, n) => typeof v === 'string' && new RegExp(`^0x[0-9a-fA-F]{${n}}$`).test(v);
export function inventory(record, expected) {
  if (!record || !expected) throw Error('CONTEXT');
  for (const v of [record, expected]) {
    if (!/^[1-9][0-9]*$/.test(v.chainId) || typeof v.chainId !== 'string' ||
        typeof v.blockNumber !== 'string' || !/^(0|[1-9][0-9]*)$/.test(v.blockNumber) ||
        !hex(v.blockHash, 64) || !hex(v.address, 40) || !hex(v.codeHash, 64)) throw Error('CONTEXT');
  }
  for (const key of ['chainId', 'blockNumber', 'blockHash', 'address', 'codeHash']) {
    if (record[key].toLowerCase() !== expected[key].toLowerCase()) throw Error('BINDING_' + key);
  }
  if (typeof record.code !== 'string' || !/^0x(?:[0-9a-fA-F]{2})+$/.test(record.code)) throw Error('CODE');
  // Bound untrusted input before hashing or allocating its byte representation.
  if (record.code.length > 2 + 1024 * 1024 * 2) throw Error('CODE_LIMIT');
  if (keccak256(record.code).toLowerCase() !== record.codeHash.toLowerCase()) throw Error('CODE_HASH');
  const code = Buffer.from(record.code.slice(2), 'hex');
  const delegation = code.length === 23 && code.subarray(0, 3).toString('hex') === 'ef0100';
  const flags = [];
  if (delegation) flags.push({ kind: 'delegation-designator', target: '0x' + code.subarray(3).toString('hex') });
  else {
    // Linear inventory only: unreachable code and metadata may produce flags.
    // PUSH payloads are data, not instructions. This is not control-flow analysis.
    for (let pc = 0; pc < code.length; pc++) {
      const op = code[pc];
      if (op >= 0x60 && op <= 0x7f) {
        const size = op - 0x5f;
        if (pc + size >= code.length) flags.push({ kind: 'truncated-push', offset: pc });
        pc += size;
      } else if ([0xf1, 0xf2, 0xf4, 0xfa, 0xff].includes(op)) {
        flags.push({ kind: ({ 241:'call', 242:'callcode', 244:'delegatecall', 250:'staticcall', 255:'selfdestruct' })[op], offset:pc });
      }
    }
  }
  return {
    context: Object.fromEntries(['chainId','blockNumber','blockHash','address','codeHash'].map(k => [k,record[k]])),
    bytes: code.length, flags, format: delegation ? 'delegation-designator' : code[0] === 0xef ? 'unsupported-prefixed-code' : 'legacy-linear-scan',
    status:'REVIEW_REQUIRED', chainEvidenceVerified:false, sourceMatchVerified:false,
    upgradeAuthorityVerified:false, tokenSemanticsVerified:false, productionAccepted:false,
    limitations:'Caller-supplied context and hash are not authenticated state evidence. No flags does not prove immutability or safety. Resolve external targets, storage, source, authority and chain proofs separately.'
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(inventory(JSON.parse(readFileSync(process.argv[2])), JSON.parse(readFileSync(process.argv[3]))), null, 2));
}
