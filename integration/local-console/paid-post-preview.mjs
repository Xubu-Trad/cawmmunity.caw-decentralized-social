import assert from 'node:assert/strict';
import {id, keccak256, toUtf8Bytes, TypedDataEncoder} from 'ethers';
import {readJsonFile} from './read-proof-file.mjs';
import {pathToFileURL} from 'node:url';

// This domain belongs exclusively to the retained C-007 synthetic lifecycle.
const domain = Object.freeze({name:'CAW C007 Synthetic Action', version:'1', chainId:31337,
  verifyingContract:'0xbff9228b938b3676578a88b5962abbd2709c9c46'});
const integers = ['accountId','epoch','nonce','validAfter','deadline'];
const types = {Post:[...integers.map(name => ({name,type:'uint256'})),
  {name:'stakeRoot',type:'bytes32'}, {name:'textHash',type:'bytes32'},
  {name:'fee',type:'uint256'}, {name:'profile',type:'bytes32'}]};

export function previewPaidPost(input) {
  assert.deepEqual(Object.keys(input).sort(), [...integers,'stakeRoot','text'].sort(), 'unexpected preview fields');
  for (const name of integers) {
    assert.equal(typeof input[name], 'string', name);
    assert.match(input[name], /^(0|[1-9][0-9]{0,77})$/, name);
    assert(BigInt(input[name]) < 2n**256n, name);
  }
  assert.equal(input.accountId, '1', 'fixed fixture payer');
  assert(BigInt(input.validAfter) < BigInt(input.deadline), 'empty validity window');
  assert.match(input.stakeRoot, /^0x[0-9a-fA-F]{64}$/);
  assert.equal(typeof input.text, 'string');
  assert(input.text.length > 0 && input.text.length <= 840 && [...input.text].length <= 420, 'post length');
  for (const char of input.text) {
    const point = char.codePointAt(0);
    assert(point < 0xd800 || point > 0xdfff, 'invalid Unicode scalar');
  }
  const {text, ...fields} = input;
  const message = {...fields, textHash:keccak256(toUtf8Bytes(text)), fee:String(5000n*10n**18n),
    profile:id('CAW_C007_SYNTHETIC_POST_V1')};
  return {scope:'OFFLINE_C007_SYNTHETIC_PREVIEW', text, feeMockTokens:'5000',
    digest:TypedDataEncoder.hash(domain, types, message),
    typedData:TypedDataEncoder.getPayload(domain, types, message)};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  assert.equal(process.argv.length, 3, 'usage: node paid-post-preview.mjs request.json');
  console.log(JSON.stringify(previewPaidPost(readJsonFile(process.argv[2], 16384)), null, 2));
}
