import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const [worktree, parentDir, outDir, commit] =
  process.argv.slice(2);

const { keccak256Hex: keccak } = await import(
  pathToFileURL(
    join(worktree, 'reference/keccak256.mjs')
  ).href
);

const read = path => readFileSync(path);
const sha = bytes =>
  createHash('sha256').update(bytes).digest('hex');

const hashText = value => keccak(
  '0x' + Buffer.from(value, 'utf8').toString('hex')
);

const word = value =>
  BigInt(value).toString(16).padStart(64, '0');

const hashWords = values =>
  keccak('0x' + values.join(''));

const parentFile = join(parentDir, 'results.json');
const parent = JSON.parse(read(parentFile));

assert.equal(parent.parent_commit, commit);
assert.equal(parent.c007, 'OPEN');
assert.equal(parent.signing_execution_digest_equal, true);
assert.equal(parent.evm_executed, false);

const contractFile = join(
  worktree, 'experiments/paid-action/CawPaidActionProbe.sol'
);
const source = read(contractFile).toString('utf8');

assert.equal(parent.source_sha256, sha(read(contractFile)));
assert.ok(source.includes(
  'return keccak256(abi.encode(stakes[1], stakes[2], stakes[3]));'
));

const DOMAIN = hashText(
  'EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)'
);
const NAME = hashText('CAW Paid Action Experiment');
const VERSION = hashText('1');
const POST = hashText(
  'Post(uint256 accountId,uint256 epoch,uint256 nonce,uint256 validAfter,uint256 deadline,bytes32 distributionHash,bytes32 textHash,uint256 fee,bytes32 profile)'
);
const PROFILE = hashText(
  'CAW_PAID_ACTION_THREE_ID_POOL_LOCKED_STAKE_UTF8_SCALARS_V1'
);

const request = parent.request;
const selection = parent.selection;
const fee = 5000n * 10n ** 18n;

assert.equal(request.distributionHash, parent.distribution_hash);

function digest(distributionHash) {
  const domain = hashWords([
    DOMAIN.slice(2),
    NAME.slice(2),
    VERSION.slice(2),
    word(selection.chainId),
    word(selection.verifyingContract)
  ]);

  const textHash = keccak(request.text);

  const structHash = hashWords([
    POST.slice(2),
    word(request.accountId),
    word(request.epoch),
    word(request.nonce),
    word(request.validAfter),
    word(request.deadline),
    distributionHash.slice(2),
    textHash.slice(2),
    word(fee),
    PROFILE.slice(2)
  ]);

  return {
    domain,
    structHash,
    digest: keccak(
      '0x1901' + domain.slice(2) + structHash.slice(2)
    )
  };
}

// Retained source-compatible digest is the control.
const existing = digest(parent.distribution_hash);

assert.equal(existing.digest, parent.signing.digest);
assert.equal(existing.digest, parent.execution.digest);

// Synthetic addresses represent owners A and B.
// They are NOT actual wallet identities or chain evidence.
const ADDRESSES = {
  A: '0x' + 'aa'.repeat(20),
  B: '0x' + 'bb'.repeat(20)
};

const signingOwners = parent.signing_owners;
const executionOwners = parent.execution_owners;

assert.deepEqual(signingOwners, {
  '1': 'A', '2': 'A', '3': 'B'
});
assert.deepEqual(executionOwners, {
  '1': 'A', '2': 'B', '3': 'B'
});

function ownerCommitment(owners) {
  const encoded = [1, 2, 3].map(id => {
    const owner = ADDRESSES[owners[String(id)]];
    assert.ok(owner);
    return word(owner);
  });
  return {
    encodedOwners: '0x' + encoded.join(''),
    ownerHash: hashWords(encoded)
  };
}

function candidate(owners) {
  const ownership = ownerCommitment(owners);

  // Hypothetical new distributionHash definition:
  // hash(stakeHash, recipientOwnershipHash).
  const combinedHash = hashWords([
    parent.distribution_hash.slice(2),
    ownership.ownerHash.slice(2)
  ]);

  return {
    ...ownership,
    combinedHash,
    ...digest(combinedHash)
  };
}

// ONE variable: owner of NFT2, A before / B after.
const signing = candidate(signingOwners);
const execution = candidate(executionOwners);

assert.notEqual(
  signing.ownerHash, execution.ownerHash
);
assert.notEqual(
  signing.combinedHash, execution.combinedHash
);
assert.notEqual(
  signing.digest, execution.digest
);

// All other signed domain inputs remain unchanged.
assert.equal(signing.domain, execution.domain);

// Neither candidate is accepted by the unmodified
// source distributionHash() equality check.
assert.notEqual(
  signing.combinedHash, parent.distribution_hash
);
assert.notEqual(
  execution.combinedHash, parent.distribution_hash
);

assert.deepEqual(
  candidate(signingOwners), signing
);
assert.deepEqual(
  candidate(executionOwners), execution
);

const result = {
  schema: 'caw-c007-owner-bound-commitment/1',
  public_parent_commit: commit,
  parent_results_sha256: sha(read(parentFile)),
  source_sha256: sha(read(contractFile)),
  variable: 'recipient NFT2 ownership A to B',
  account_ids: [1, 2, 3],
  synthetic_addresses: ADDRESSES,
  policy: 'HYPOTHETICAL owner-bound distributionHash',
  source_rule: 'account-ID exclusion; stake-only commitment',
  fixed_stake_hash: parent.distribution_hash,
  fixed_request: request,
  fixed_selection: selection,
  existing_digest: existing.digest,
  existing_digest_unchanged: true,
  signing,
  execution,
  candidate_digest_changed: true,
  candidate_accepted_by_current_contract: false,
  signature_verified: false,
  evm_executed: false,
  policy_adopted: false,
  c007: 'OPEN'
};

writeFileSync(
  join(outDir, 'results.json'),
  JSON.stringify(result, null, 2) + '\n',
  { flag: 'wx' }
);

console.log('PARENT=VERIFIED');
console.log('SOURCE_STAKE_HASH=' + parent.distribution_hash);
console.log('EXISTING_DIGEST=' + existing.digest);
console.log('EXISTING_DIGEST_UNCHANGED=PASS');
console.log('CANDIDATE_SIGNING_DIGEST=' + signing.digest);
console.log('CANDIDATE_EXECUTION_DIGEST=' + execution.digest);
console.log('CANDIDATE_DIGEST_CHANGED=PASS');
console.log('CANDIDATE_SOURCE_ACCEPTANCE=REJECTED_BY_HASH_CHECK');
console.log('SIGNATURE_VERIFICATION=NOT_RUN');
console.log('EVM_EXECUTION=NOT_RUN');
console.log('C007=OPEN');
console.log('PASS: C007 owner-bound commitment V1');
