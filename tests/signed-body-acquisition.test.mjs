import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { inspectBlockBodyCapture } from '../experiments/paid-body-acquisition/verify_body.mjs';

const root = new URL('../experiments/paid-signed-body-acquisition/', import.meta.url);
const bytes = readFileSync(new URL('body-captures.json', root));
assert.equal(createHash('sha256').update(bytes).digest('hex'), 'e2db3326525f1b6b3e24af6582482220c7db1cf8d2e5a1099005caca84ba0c36');
const captures = JSON.parse(bytes);
const clone = value => structuredClone(value);
const selection = c => ({ schema: 'caw-block-body-selection/1', profile: 'london-16',
  number: c.header.number, hash: c.header.hash });
const inspect = c => inspectBlockBodyCapture(c, selection(c));
const sample = () => clone(captures.branches.left[0]);
const rejected = fn => assert.throws(fn, e => /^(BLOCK_BODY_|BLOCK_TRANSACTIONS_|BLOCK_RECEIPTS_|EXEC_HEADER_)/.test(e.code ?? ''));

test('complete genuinely signed local bodies pass the unchanged strict acquisition verifier', () => {
  assert.equal(captures.synthetic_chain, true);
  assert.equal(captures.independent_providers, false);
  const distinct = new Set();
  for (const name of ['left', 'right']) {
    assert.equal(captures.branches[name].length, 15);
    for (const c of captures.branches[name]) {
      distinct.add(c.header.hash);
      const result = inspect(c), body = result.body_integrity;
      assert.equal(result.rpcTransactionHashesVerified, true);
      assert.equal(body.transactionCommitmentVerified, true);
      assert.equal(body.receiptCommitmentVerified, true);
      assert.equal(body.transactionAssociationVerified, true);
      assert.equal(body.transactionCount, 1);
      const tx = body.transactions[0];
      assert.equal(tx.hash, c.header.transactions[0]);
      assert.equal(tx.hash, c.receipts[0].transactionHash);
      assert.equal(tx.type, '0x0');
      assert.ok([62709n, 62710n].includes(BigInt(tx.v)));
      assert.ok(BigInt(tx.r) > 1n && BigInt(tx.s) > 1n);
      for (const flag of ['senderVerified', 'signaturesVerified', 'executionVerified', 'endpointAuthenticated', 'consensusVerified', 'finalityVerified', 'freshnessVerified']) {
        assert.equal(body[flag], false, flag);
      }
    }
  }
  assert.equal(distinct.size, 20);
  assert.equal(captures.branches.left.at(-1).header.number, captures.branches.right.at(-1).header.number);
  assert.notEqual(captures.branches.left.at(-1).header.hash, captures.branches.right.at(-1).header.hash);
});

test('captured raw bytes match exact local submissions in the retained transcript', () => {
  const archive = readFileSync(new URL('execution-trace.json.gz', root));
  const expanded = gunzipSync(archive, { maxOutputLength: 8 * 1024 * 1024 });
  assert.equal(createHash('sha256').update(expanded).digest('hex'), '6ca0685230a9917eb3d73ce0a74666c9d4442059883df65f4a374551735c2975');
  const trace = JSON.parse(expanded);
  assert.equal(trace.status, 'pass'); assert.equal(trace.owned_listener_released, true);
  assert.equal(trace.node.upstream_forwarded_count, 0); assert.equal(trace.node.proxy_request_count, 0);
  assert.equal(trace.node.non_impersonated_submission, true);
  assert.equal(trace.signing.impersonation_enabled, false); assert.equal(trace.signing.real_wallet_used, false);
  const forbidden = ['eth_sendTransaction', 'anvil_impersonateAccount', 'anvil_stopImpersonatingAccount', 'anvil_autoImpersonateAccount'];
  assert.ok(trace.rpc.every(row => !forbidden.includes(row.request.method)));
  const sent = trace.rpc.filter(row => row.request.method === 'eth_sendRawTransaction');
  assert.equal(sent.length, trace.submissions.length);
  assert.equal(sent.length, trace.node.local_signed_raw_attempts);
  const submitted = new Map();
  trace.submissions.forEach((s, i) => {
    assert.equal(sent[i].request.params[0], s.raw); assert.equal(sent[i].response.result, s.hash);
    assert.equal(s.chain_id, 31337); assert.equal(s.generic_sender_verifier, false);
    assert.equal(s.known_test_public_key_signature_checked, true);
    submitted.set(s.hash, s);
  });
  for (const c of [...captures.branches.left, ...captures.branches.right]) {
    const s = submitted.get(c.header.transactions[0]); assert.ok(s);
    assert.equal(s.raw, c.raw_transactions[0]); assert.equal(s.block_hash, c.header.hash);
    assert.equal(s.test_sender, c.receipts[0].from);
  }
});

test('a changed signature byte cannot retain the original transaction commitment', () => {
  const c = sample(), raw = c.raw_transactions[0];
  c.raw_transactions[0] = raw.slice(0, -2) + (raw.endsWith('01') ? '02' : '01');
  rejected(() => inspect(c));
});

test('consistent replacement RPC labels cannot override the signed raw-byte hash', () => {
  const c = sample(); c.header.transactions[0] = '0x' + 'ff'.repeat(32);
  c.receipts[0].transactionHash = c.header.transactions[0];
  assert.throws(() => inspect(c), { code: 'BLOCK_BODY_TRANSACTION_HASH' });
});

test('missing raw transactions or receipts cannot become a complete body', () => {
  for (const field of ['raw_transactions', 'receipts']) {
    const c = sample(); c[field] = []; rejected(() => inspect(c));
  }
});

test('a receipt from the other branch cannot attach to this selected block', () => {
  const c = clone(captures.branches.left.at(-1));
  c.receipts = clone(captures.branches.right.at(-1).receipts);
  rejected(() => inspect(c));
});

test('a caller must supply the selected endpoint rather than accepting a replacement', () => {
  const c = sample(), s = selection(c); s.hash = '0x' + 'ff'.repeat(32);
  rejected(() => inspectBlockBodyCapture(c, s));
});

test('successful byte binding does not authenticate optional RPC sender metadata', () => {
  const c = sample(); c.receipts[0].from = '0x' + 'aa'.repeat(20);
  const result = inspect(c);
  assert.equal(result.rpcTransactionHashesVerified, true);
  assert.equal(result.body_integrity.senderVerified, false);
  assert.equal(Object.hasOwn(result.body_integrity.transactions[0], 'from'), false);
});
