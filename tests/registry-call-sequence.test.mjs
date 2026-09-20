import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectRegistryCallSequence } from '../reference/paid-registry-permissions.mjs';

// Original synthetic transcripts derived from TestAccountRegistry.sol, not
// from the reader's parsing, event construction or permission replay helpers.
// These labels are public fixtures. No signature, EVM or network is used here.
const ZERO = '0x' + '00'.repeat(20);
const A = '0x' + '11'.repeat(20), B = '0x' + '22'.repeat(20);
const C = '0x' + '33'.repeat(20), D = '0x' + '44'.repeat(20);
const REGISTRY = '0x' + 'aa'.repeat(20);
const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const APPROVAL = '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925';
const OPERATOR = '0x17307eab39ab6107e8899845ad3d59bd9653f200f220920489ca2b5937696c31';
const SELECTOR = { approve: '0x095ea7b3', operator: '0xa22cb465', transfer: '0x23b872dd', safe: '0x42842e0e', safeData: '0xb88d4fde' };
const word = value => BigInt(value).toString(16).padStart(64, '0');
const topic = value => '0x' + word(value);
const selection = () => ({ schema: 'caw-registry-selection/1', profile: 'test-account-registry-direct-v1',
  registry: REGISTRY, firstOwner: A, secondOwner: B });
const inspect = (sequence, chosen = selection()) => inspectRegistryCallSequence(sequence, chosen);
const clone = structuredClone;
const rejected = (fn, code) => assert.throws(fn, error => code
  ? error.code === 'PAID_REGISTRY_' + code : /^PAID_REGISTRY_/.test(error.code ?? ''));
const event = (signature, from, to, id) => ({ address: REGISTRY,
  topics: [signature, topic(from), topic(to), topic(id)], data: '0x' });
const entry = (from, data, logs, status = '0x1') => ({ from, to: REGISTRY, value: '0x0', data, status, logs });
const approval = (caller, owner, to, id = 1) => entry(caller, SELECTOR.approve + word(to) + word(id), [event(APPROVAL, owner, to, id)]);
const operator = (owner, delegate, allowed) => entry(owner, SELECTOR.operator + word(delegate) + word(allowed ? 1 : 0),
  [{ address: REGISTRY, topics: [OPERATOR, topic(owner), topic(delegate)], data: topic(allowed ? 1 : 0) }]);
function transfer(caller, from, to, id = 1, kind = 'transfer', payload = '0x') {
  let data = SELECTOR[kind] + word(from) + word(to) + word(id);
  if (kind === 'safeData') {
    const hex = payload.slice(2), length = hex.length / 2;
    data += word(128) + word(length) + hex.padEnd(Math.ceil(length / 32) * 64, '0');
  }
  return entry(caller, data, [event(APPROVAL, from, ZERO, id), event(TRANSFER, from, to, id)]);
}
function replaceWord(data, index, replacement) {
  const offset = 10 + index * 64;
  return data.slice(0, offset) + word(replacement) + data.slice(offset + 64);
}
function recursivelyFrozen(value) {
  if (value && typeof value === 'object') {
    assert.ok(Object.isFrozen(value));
    for (const child of Object.values(value)) recursivelyFrozen(child);
  }
}

test('empty sequence reports conditional initial state and no authenticated or live permission', () => {
  const result = inspect([]);
  assert.equal(result.schema, 'caw-registry-call-sequence/1');
  assert.equal(result.profile, 'test-account-registry-direct-v1');
  assert.deepEqual(result.final, { owners: [A, A, B], approved: [ZERO, ZERO, ZERO], epochs: ['0', '0', '0'], operators: [] });
  assert.deepEqual(result.operations, []);
  assert.equal(result.successfulCalls, 0); assert.equal(result.failedCallsNotPermissionChecked, 0);
  assert.equal(result.registryPermissionRulesVerified, true);
  assert.equal(result.initialStateAssumption, 'supplied-constructor-owners-zero-approvals-and-epochs');
  for (const flag of ['senderVerified', 'accountAuthorityVerified', 'codeAbsenceVerified', 'currentPermissionVerified',
    'receiverCallbacksVerified', 'executionVerified', 'endpointAuthenticated', 'consensusVerified', 'finalityVerified', 'freshnessVerified']) {
    assert.equal(result[flag], false, flag);
  }
});

test('constructor owner labels may coincide, matching the fixture constructor', () => {
  const chosen = selection(); chosen.secondOwner = A;
  const result = inspect([transfer(A, A, B, 3)], chosen);
  assert.deepEqual(result.final.owners, [A, A, B]);
  assert.deepEqual(result.final.epochs, ['0', '0', '1']);
});

test('owner transfers and self-transfers clear approval and advance every epoch', () => {
  const result = inspect([approval(A, A, C), transfer(A, A, A), transfer(A, A, B), transfer(B, B, A)]);
  assert.deepEqual(result.final.owners, [A, A, B]);
  assert.deepEqual(result.final.epochs, ['3', '0', '0']);
  assert.deepEqual(result.final.approved, [ZERO, ZERO, ZERO]);
  assert.deepEqual(result.operations.slice(1).map(x => [x.authorization, x.previousEpoch, x.epoch]),
    [['owner', '0', '1'], ['owner', '1', '2'], ['owner', '2', '3']]);
});

test('per-token approval authorizes one transfer and never spills into another account', () => {
  const prefix = [approval(A, A, C)];
  const result = inspect([...prefix, transfer(C, A, B)]);
  assert.equal(result.operations[1].authorization, 'token-approval');
  assert.deepEqual(result.final.approved, [ZERO, ZERO, ZERO]);
  rejected(() => inspect([...prefix, transfer(C, A, B, 2)]), 'NOT_AUTHORIZED');
  rejected(() => inspect([...prefix, transfer(C, A, B), transfer(C, B, A)]), 'NOT_AUTHORIZED');
});

test('a token-approved account cannot approve or replace another spender', () => {
  rejected(() => inspect([approval(A, A, C), approval(C, A, D)]), 'NOT_AUTHORIZED');
  rejected(() => inspect([approval(B, A, C)]), 'NOT_AUTHORIZED');
});

test('approval permits the owner, zero, repeated approval and explicit revocation', () => {
  const sequence = [approval(A, A, A), approval(A, A, C), approval(A, A, C), approval(A, A, ZERO), approval(A, A, ZERO)];
  const result = inspect(sequence);
  assert.equal(result.successfulCalls, 5);
  assert.deepEqual(result.final.approved, [ZERO, ZERO, ZERO]);
  assert.deepEqual(result.final.epochs, ['0', '0', '0']);
  rejected(() => inspect([...sequence, transfer(C, A, B)]), 'NOT_AUTHORIZED');
});

test('replacement and self-transfer both invalidate previously granted token approvals', () => {
  rejected(() => inspect([approval(A, A, C), approval(A, A, D), transfer(C, A, B)]), 'NOT_AUTHORIZED');
  const replacement = inspect([approval(A, A, C), approval(A, A, D), transfer(D, A, B)]);
  assert.equal(replacement.operations[2].authorization, 'token-approval');
  rejected(() => inspect([approval(A, A, C), transfer(A, A, A), transfer(C, A, B)]), 'NOT_AUTHORIZED');
});

test('owner-wide operators can approve and transfer all accounts of that owner only', () => {
  const prefix = [operator(A, C, true), approval(C, A, D, 2)];
  const result = inspect([...prefix, transfer(C, A, B, 1), transfer(D, A, B, 2)]);
  assert.deepEqual(result.operations.map(x => x.authorization ?? null), [null, 'operator', 'operator', 'token-approval']);
  assert.deepEqual(result.final.owners, [B, B, B]);
  rejected(() => inspect([...prefix, transfer(C, B, A, 3)]), 'NOT_AUTHORIZED');
});

test('operator authority follows its owner key, survives a round trip, then revokes', () => {
  const prefix = [operator(A, C, true), transfer(A, A, B)];
  rejected(() => inspect([...prefix, transfer(C, B, A)]), 'NOT_AUTHORIZED');
  const returned = [...prefix, transfer(B, B, A), transfer(C, A, A)];
  const result = inspect(returned);
  assert.equal(result.operations[3].authorization, 'operator');
  assert.deepEqual(result.final.epochs, ['3', '0', '0']);
  assert.deepEqual(result.final.operators, [{ owner: A, operator: C, allowed: true }]);
  const revoked = [...returned, operator(A, C, false)];
  assert.deepEqual(inspect(revoked).final.operators, [{ owner: A, operator: C, allowed: false }]);
  rejected(() => inspect([...revoked, transfer(C, A, B)]), 'NOT_AUTHORIZED');
  rejected(() => inspect([...revoked, approval(C, A, D)]), 'NOT_AUTHORIZED');
});

test('operator settings permit zero and nonowners, reject self, and retain no-op events', () => {
  const result = inspect([operator(C, D, true), operator(A, ZERO, true), operator(C, D, true), operator(C, D, false), operator(C, D, false)]);
  assert.equal(result.successfulCalls, 5);
  assert.deepEqual(result.final.operators, [
    { owner: A, operator: ZERO, allowed: true }, { owner: C, operator: D, allowed: false }
  ]);
  rejected(() => inspect([operator(A, A, true)]), 'SELF_OPERATOR');
  rejected(() => inspect([operator(A, A, false)]), 'SELF_OPERATOR');
});

test('transfer checks current from owner, nonzero destination and the three-ID domain', () => {
  rejected(() => inspect([transfer(A, B, C)]), 'WRONG_FROM');
  rejected(() => inspect([transfer(C, A, B)]), 'NOT_AUTHORIZED');
  rejected(() => inspect([transfer(A, A, ZERO)]), 'ZERO_RECIPIENT');
  for (const id of [0, 4, (1n << 256n) - 1n]) {
    rejected(() => inspect([transfer(A, A, B, id)]), 'ACCOUNT');
    rejected(() => inspect([approval(A, A, C, id)]), 'ACCOUNT');
  }
});

test('both safe overloads accept exact canonical data through the 4096-byte boundary', () => {
  assert.equal(inspect([transfer(A, A, B, 1, 'safe')]).operations[0].kind, 'safe');
  for (const length of [0, 1, 31, 32, 33, 4096]) {
    const result = inspect([transfer(A, A, B, 1, 'safeData', '0x' + 'a5'.repeat(length))]);
    assert.equal(result.operations[0].kind, 'safeData');
    assert.deepEqual(result.final.owners, [B, A, B]);
    assert.equal(result.receiverCallbacksVerified, false);
  }
});

test('safe dynamic data rejects alias offsets, bad padding, over-limit and unused tails', () => {
  const valid = transfer(A, A, B, 1, 'safeData', '0xab');
  const cases = [
    replaceWord(valid.data, 3, 96), replaceWord(valid.data, 3, 160),
    replaceWord(valid.data, 4, 4097), valid.data.slice(0, -2), valid.data + word(0),
    valid.data.slice(0, -2) + '01',
    transfer(A, A, B, 1, 'safeData', '0x' + 'ab'.repeat(4097)).data,
    valid.data.slice(0, 10 + 4 * 64)
  ];
  for (const data of cases) rejected(() => inspect([{ ...valid, data }]), 'ABI');
  const zero = transfer(A, A, B, 1, 'safeData');
  rejected(() => inspect([{ ...zero, data: zero.data + word(0) }]), 'ABI');
});

test('static ABI refuses dirty address words, nonboolean flags and surplus bytes', () => {
  const approve = approval(A, A, C), move = transfer(A, A, B), toggle = operator(A, C, true);
  for (const [original, data] of [
    [approve, replaceWord(approve.data, 0, 1n << 160n)],
    [move, replaceWord(move.data, 0, 1n << 160n)],
    [move, replaceWord(move.data, 1, 1n << 160n)],
    [toggle, replaceWord(toggle.data, 0, 1n << 160n)],
    [toggle, replaceWord(toggle.data, 1, 2)],
    [approve, approve.data + '00'], [move, move.data.slice(0, -2)],
    [toggle, toggle.data + word(0)]
  ]) rejected(() => inspect([{ ...original, data }]), 'ABI');
  rejected(() => inspect([{ ...move, data: '0xdeadbeef' }]), 'UNSUPPORTED_CALL');
  for (const data of ['0x0', '0X00', '0xAA', '0xgg', '0x00\n'])
    rejected(() => inspect([{ ...move, data }]), 'DATA');
});

test('successful calls require the complete matching events, never a matching subset', () => {
  const move = transfer(A, A, B);
  const mutations = [
    x => { x.logs = []; }, x => { x.logs.pop(); }, x => { x.logs.shift(); },
    x => { x.logs.reverse(); }, x => { x.logs[0].topics[2] = topic(C); },
    x => { x.logs[1].topics[1] = topic(C); }, x => { x.logs[1].topics[2] = topic(C); },
    x => { x.logs[1].topics[3] = topic(2); }, x => { x.logs[1].address = C; },
    x => { x.logs[1].data = topic(0); }, x => { x.logs[1].topics[0] = APPROVAL; },
    x => { x.logs[0] = clone(x.logs[1]); }
  ];
  for (const mutate of mutations) { const changed = clone(move); mutate(changed); rejected(() => inspect([changed]), 'EVENTS'); }
  rejected(() => inspect([{ ...move, logs: [...move.logs, clone(move.logs[1])] }]), 'LOGS');
  const approve = approval(A, A, C); approve.logs[0].topics[1] = topic(B);
  rejected(() => inspect([approve]), 'EVENTS');
  const toggle = operator(A, C, true); toggle.logs[0].data = topic(0);
  rejected(() => inspect([toggle]), 'EVENTS');
});

test('failed calls have no inferred permission verdict and cannot mutate approvals or epochs', () => {
  const failed = (data, caller = D) => entry(caller, data, [], '0x0');
  const sequence = [approval(A, A, C), failed('0x'), failed('0xdeadbeef'),
    failed(transfer(C, A, B).data, C), failed(operator(A, C, true).data, A), transfer(C, A, B)];
  const result = inspect(sequence);
  assert.equal(result.successfulCalls, 2); assert.equal(result.failedCallsNotPermissionChecked, 4);
  assert.deepEqual(result.operations.map(x => x.index), [0, 5]);
  assert.equal(result.operations[1].authorization, 'token-approval');
  assert.deepEqual(result.final.epochs, ['1', '0', '0']);
  assert.deepEqual(result.final.operators, []);
  assert.deepEqual(result.final.approved, [ZERO, ZERO, ZERO]);
});

test('failed calls still require zero logs, direct target, zero value and bounded hex', () => {
  const failed = { ...transfer(A, A, B), status: '0x0' };
  rejected(() => inspect([failed]), 'FAILED_LOGS');
  for (const patch of [{ to: C }, { value: '0x1' }, { value: '0x00' }])
    rejected(() => inspect([{ ...failed, logs: [], ...patch }]), 'DIRECT_CALL');
  rejected(() => inspect([{ ...failed, logs: [], data: '0x' + '00'.repeat(8193) }]), 'DATA');
});

test('sequence and per-call byte bounds are inclusive without restoring execution claims', () => {
  const failed = entry(A, '0x', [], '0x0');
  const result = inspect(Array.from({ length: 256 }, () => clone(failed)));
  assert.equal(result.failedCallsNotPermissionChecked, 256);
  rejected(() => inspect(Array.from({ length: 257 }, () => clone(failed))), 'SEQUENCE_LIMIT');
  assert.equal(inspect([entry(A, '0x' + '00'.repeat(8192), [], '0x0')]).failedCallsNotPermissionChecked, 1);
});

test('selection and entry schemas are exact and no caller coercion is performed', () => {
  rejected(() => inspectRegistryCallSequence([]), 'SCHEMA');
  rejected(() => inspectRegistryCallSequence([], selection(), true), 'SCHEMA');
  for (const patch of [{ schema: 'other' }, { profile: 'other' }, { extra: true }])
    rejected(() => inspect([], { ...selection(), ...patch }), 'SCHEMA');
  for (const key of Object.keys(selection())) { const value = selection(); delete value[key]; rejected(() => inspect([], value), 'SCHEMA'); }
  for (const key of ['registry', 'firstOwner', 'secondOwner'])
    for (const value of [ZERO, 1, A + '\n', A.toUpperCase(), '0x11'])
      rejected(() => inspect([], { ...selection(), [key]: value }), 'ADDRESS');
  const move = transfer(A, A, B);
  for (const key of Object.keys(move)) { const value = clone(move); delete value[key]; rejected(() => inspect([value]), 'SCHEMA'); }
  rejected(() => inspect([{ ...move, extra: true }]), 'SCHEMA');
  rejected(() => inspect([{ ...move, from: ZERO }]), 'ADDRESS');
  rejected(() => inspect([{ ...move, status: true }]), 'STATUS');
  rejected(() => inspect({}), 'SEQUENCE_LIMIT');
});

test('log shape validates exact keys, topic width, address and data before replay', () => {
  for (const mutate of [
    log => { log.extra = true; }, log => { delete log.data; }
  ]) { const value = transfer(A, A, B); mutate(value.logs[0]); rejected(() => inspect([value]), 'SCHEMA'); }
  for (const topics of [[], [TRANSFER + '00'], [TRANSFER.toUpperCase()], [TRANSFER + '\n'], [TRANSFER, topic(0), topic(0), topic(1), topic(2)]]) {
    const value = transfer(A, A, B); value.logs[0].topics = topics; rejected(() => inspect([value]), 'LOGS');
  }
  const address = transfer(A, A, B); address.logs[0].address = ZERO;
  rejected(() => inspect([address]), 'ADDRESS');
  const data = transfer(A, A, B); data.logs[0].data = '0x' + '00'.repeat(33);
  rejected(() => inspect([data]), 'DATA');
});

test('getters, toJSON and supplied iterators never execute during plain-data capture', () => {
  let touched = 0;
  const getter = () => { touched++; throw new Error('must not execute'); };
  const chosen = selection(); Object.defineProperty(chosen, 'firstOwner', { enumerable: true, get: getter });
  rejected(() => inspect([], chosen), 'DESCRIPTOR');
  const move = transfer(A, A, B); Object.defineProperty(move.logs[0], 'topics', { enumerable: true, get: getter });
  rejected(() => inspect([move]), 'DESCRIPTOR');
  const calls = [transfer(A, A, B)]; Object.defineProperty(calls, '0', { enumerable: true, get: getter });
  rejected(() => inspect(calls), 'DESCRIPTOR');
  const customized = selection(); customized.toJSON = getter;
  rejected(() => inspect([], customized), 'SCHEMA');
  const iterable = [transfer(A, A, B)]; iterable[Symbol.iterator] = getter;
  rejected(() => inspect(iterable), 'SCHEMA');
  assert.equal(touched, 0);
});

test('cycles, exotic prototypes, sparse or decorated arrays and hidden keys fail closed', () => {
  const cycle = []; cycle.push(cycle); rejected(() => inspect(cycle), 'CYCLE');
  rejected(() => inspect(new Array(1)), 'SCHEMA');
  const decorated = []; decorated.extra = true; rejected(() => inspect(decorated), 'SCHEMA');
  const symbol = selection(); symbol[Symbol('extra')] = true; rejected(() => inspect([], symbol), 'SCHEMA');
  const hidden = selection(); Object.defineProperty(hidden, 'extra', { value: true, enumerable: false });
  rejected(() => inspect([], hidden), 'DESCRIPTOR');
  const inherited = Object.create(selection()); rejected(() => inspect([], inherited), 'PROTOTYPE');
  rejected(() => inspect(new Uint8Array()), 'PROTOTYPE');
  const nullChosen = Object.assign(Object.create(null), selection());
  assert.equal(inspect([], nullChosen).successfulCalls, 0);
});

test('capture rejects excessive depth, strings, item count and aggregate byte retention', () => {
  let nested = null; for (let i = 0; i < 22; i++) nested = [nested];
  rejected(() => inspect(nested), 'LIMIT');
  rejected(() => inspect([], { ...selection(), firstOwner: 'x'.repeat(262145) }), 'STRING');
  rejected(() => inspect([], { ...selection(), firstOwner: '\ud800' }), 'STRING');
  const many = Array.from({ length: 64 }, () => Array(1600).fill(null));
  rejected(() => inspect(many), 'LIMIT');
  const large = Array(34).fill('x'.repeat(262144));
  rejected(() => inspect(large), 'LIMIT');
  for (const value of [-0, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1])
    rejected(() => inspect([], { ...selection(), firstOwner: value }), 'INTEGER');
});

test('results are recursively frozen, detached and do not alter accepted or rejected inputs', () => {
  const sequence = [operator(A, C, true), approval(C, A, D, 2), transfer(D, A, B, 2)], chosen = selection();
  const before = JSON.stringify({ sequence, chosen });
  const result = inspect(sequence, chosen); recursivelyFrozen(result);
  assert.equal(JSON.stringify({ sequence, chosen }), before);
  sequence[0].logs[0].data = topic(0); chosen.firstOwner = D;
  assert.equal(result.selection.firstOwner, A);
  assert.deepEqual(result.final.owners, [A, B, B]);
  assert.equal(result.final.operators[0].allowed, true);
  assert.throws(() => { result.final.owners[0] = D; }, TypeError);
  const bad = transfer(C, A, B), saved = JSON.stringify(bad);
  rejected(() => inspect([bad]), 'NOT_AUTHORIZED'); assert.equal(JSON.stringify(bad), saved);
  assert.deepEqual(inspect([]).final.approved, [ZERO, ZERO, ZERO]);
});
