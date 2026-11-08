import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const [w, p, out, commit] = process.argv.slice(2);

const { keccak256Hex: keccak } = await import(
  pathToFileURL(join(w, 'reference/keccak256.mjs')).href
);

const read = name => readFileSync(name);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const hash = text => keccak(
  '0x' + Buffer.from(text, 'utf8').toString('hex')
);

const word = value => BigInt(value).toString(16).padStart(64, '0');
const hashWords = values => keccak('0x' + values.join(''));

const sourceFile = join(w, 'experiments/paid-action/CawPaidActionProbe.sol');
const source = read(sourceFile).toString('utf8');

for (const required of [
  'return keccak256(abi.encode(stakes[1], stakes[2], stakes[3]));',
  'if (id != payer) eligible += stakes[id];',
  'return keccak256(abi.encodePacked(hex"1901", domainSeparator(), body));'
]) {
  assert.ok(source.includes(required), required);
}

const parent = JSON.parse(read(join(p, 'results.json')));
assert.equal(parent.parent_commit, commit);
assert.equal(parent.source_sha256, sha(read(sourceFile)));
assert.equal(parent.c007, 'OPEN');
assert.equal(parent.evm_executed, false);

const fixtureFile = join(
  w, 'reference/fixtures/paid-post-signatures-v1.json'
);
const fixture = JSON.parse(read(fixtureFile));
const vector = fixture.positive.find(x => x.name === 'ascii');
assert.ok(vector);

const domainType = hash(
  'EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)'
);
const nameHash = hash('CAW Paid Action Experiment');
const versionHash = hash('1');
const postType = hash(
  'Post(uint256 accountId,uint256 epoch,uint256 nonce,uint256 validAfter,uint256 deadline,bytes32 distributionHash,bytes32 textHash,uint256 fee,bytes32 profile)'
);
const profile = hash(
  'CAW_PAID_ACTION_THREE_ID_POOL_LOCKED_STAKE_UTF8_SCALARS_V1'
);
const fee = 5000n * 10n ** 18n;

function digest(request, selection) {
  const domainPreimage = [
    domainType.slice(2), nameHash.slice(2), versionHash.slice(2),
    word(selection.chainId), word(selection.verifyingContract)
  ];
  const domainSeparator = hashWords(domainPreimage);

  const textHash = keccak(request.text);
  const structPreimage = [
    postType.slice(2), word(request.accountId),
    word(request.epoch), word(request.nonce),
    word(request.validAfter), word(request.deadline),
    request.distributionHash.slice(2), textHash.slice(2),
    word(fee), profile.slice(2)
  ];
  const structHash = hashWords(structPreimage);

  const calculated = keccak(
    '0x1901' + domainSeparator.slice(2) + structHash.slice(2)
  );

  return {
    domainSeparator, textHash, structHash,
    digest: calculated,
    domainPreimage: '0x' + domainPreimage.join(''),
    structPreimage: '0x' + structPreimage.join('')
  };
}

// Existing independently retained EIP-712 fixture control.
const control = digest(vector.expected.request, vector.selection);

for (const field of [
  'domainSeparator', 'textHash', 'structHash', 'digest'
]) {
  assert.equal(control[field], vector.expected[field], field);
}

const stakes = [1, 2, 3].map(id =>
  BigInt(parent.fixed_stakes_base_units[String(id)])
);

const distributionHash = hashWords(stakes.map(word));
const request = {
  ...vector.expected.request,
  distributionHash
};

// One variable: recipient-owner snapshot.
// No request/signing/domain/stake field changes.
const signing = digest(request, vector.selection);
const execution = digest(request, vector.selection);

assert.deepEqual(parent.signing_owners, {
  '1': 'A', '2': 'A', '3': 'B'
});
assert.deepEqual(parent.execution_owners, {
  '1': 'A', '2': 'B', '3': 'B'
});
assert.notDeepEqual(
  parent.signing_snapshot.allocations_base_units,
  parent.execution_snapshot.allocations_base_units
);

assert.equal(signing.digest, execution.digest);
assert.equal(signing.structHash, execution.structHash);
assert.equal(signing.domainSeparator, execution.domainSeparator);

// Negative control, isolated from the main experiment:
// change ONLY stake 2 by one base unit.
const changedStakes = [...stakes];
changedStakes[1] += 1n;
const changedRequest = {
  ...request,
  distributionHash: hashWords(changedStakes.map(word))
};
const negative = digest(changedRequest, vector.selection);

assert.notEqual(negative.digest, signing.digest);
assert.notEqual(negative.structHash, signing.structHash);
assert.notEqual(changedRequest.distributionHash, distributionHash);
assert.equal(negative.domainSeparator, signing.domainSeparator);
assert.equal(negative.textHash, signing.textHash);

const result = {
  schema: 'caw-c007-digest-sensitivity/1',
  parent_commit: commit,
  source_sha256: sha(read(sourceFile)),
  keccak_module_sha256: sha(read(join(w, 'reference/keccak256.mjs'))),
  fixture_sha256: sha(read(fixtureFile)),
  parent_snapshot_results_sha256: sha(read(join(p, 'results.json'))),
  node_version: process.version,
  scope: 'offline exact EIP-712 arithmetic only',
  fixed_transfer: 'NFT2 owner A to B',
  hypothesis: 'wallet-owner exclusion, not adopted',
  fixed_stakes: stakes.map(String),
  fee_base_units: String(fee),
  request,
  selection: vector.selection,
  distribution_hash: distributionHash,
  signing_owners: parent.signing_owners,
  execution_owners: parent.execution_owners,
  signing_allocation: parent.signing_snapshot,
  execution_allocation: parent.execution_snapshot,
  fixture_vector_match: true,
  signing,
  execution,
  signing_execution_digest_equal: true,
  negative_control_stake2_plus_one: {
    distributionHash: changedRequest.distributionHash,
    digest: negative.digest,
    differs: true
  },
  signature_verified: false,
  evm_executed: false,
  adopted_policy: false,
  c007: 'OPEN'
};

writeFileSync(join(out, 'results.json'),
  JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });

console.log('FIXTURE_EIP712=PASS');
console.log('SNAPSHOT_OWNER_CHANGE=NFT2_A_TO_B');
console.log('STAKE_VECTOR=UNCHANGED');
console.log('DISTRIBUTION_HASH=' + distributionHash);
console.log('SIGNING_DIGEST=' + signing.digest);
console.log('EXECUTION_DIGEST=' + execution.digest);
console.log('OWNER_CHANGE_DIGEST_EQUAL=PASS');
console.log('STAKE_NEGATIVE_CONTROL=PASS');
console.log('SIGNATURE_VERIFICATION=NOT_RUN');
console.log('EVM_EXECUTION=NOT_RUN');
console.log('C007=OPEN');
console.log('PASS: C007 digest sensitivity V1');
