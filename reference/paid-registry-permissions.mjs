// Conditional permission replay for the fixed three-account registry fixture.
// A matching transcript is not an execution, account-state or consensus proof.
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { keccak256Hex } from './keccak256.mjs';
import { inspectPaidPostHistory } from './paid-post-signatures.mjs';

const PROFILE = 'test-account-registry-direct-v1';
const ZERO = '0x' + '00'.repeat(20);
const MAX = (1n << 256n) - 1n;
const RUNTIME = '4745276b40204bd6e373b3f6c2e990ba8aeb3feb2de69a97b44510c58153d68f';
const CREATION = '451b67e63f5e995f2a3bfa161ec4aa77366cf4aa8e28fb68b390ab6bc496717d';
const digest = text => keccak256Hex('0x' + Buffer.from(text, 'utf8').toString('hex'));
const word = value => BigInt(value).toString(16).padStart(64, '0');
const topic = value => '0x' + word(value);
const SIG = Object.freeze({ transfer: digest('Transfer(address,address,uint256)'),
  approval: digest('Approval(address,address,uint256)'), operator: digest('ApprovalForAll(address,address,bool)') });
const CALL = Object.freeze({ approve: '0x095ea7b3', operator: '0xa22cb465',
  transfer: '0x23b872dd', safe: '0x42842e0e', safeData: '0xb88d4fde' });
const FLAGS = Object.freeze({ accountAuthorityVerified: false, codeAbsenceVerified: false,
  currentPermissionVerified: false, receiverCallbacksVerified: false, executionVerified: false,
  endpointAuthenticated: false, consensusVerified: false, finalityVerified: false, freshnessVerified: false });
function fail(code) { const e = new Error('Paid registry rejected: ' + code + '.'); e.code = 'PAID_REGISTRY_' + code; throw e; }
function need(value, code) { if (!value) fail(code); }
function fields(value, keys) {
  need(value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key)), 'SCHEMA');
}
function address(value, zero = false) {
  need(typeof value === 'string' && /^0x[0-9a-f]{40}(?![\s\S])/.test(value) && (zero || value !== ZERO), 'ADDRESS'); return value;
}
function data(value, max = 8192) {
  need(typeof value === 'string' && value.length <= 2 + 2 * max && /^0x(?:[0-9a-f]{2})*(?![\s\S])/.test(value), 'DATA'); return value;
}
function account(value) { need(value >= 1n && value <= 3n, 'ACCOUNT'); return Number(value - 1n); }
function freeze(value) { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
function equal(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a); return keys.length === Object.keys(b).length && keys.every(k => Object.hasOwn(b, k) && equal(a[k], b[k]));
}
// All arguments detach together before any inspection. Accessors, iterators and
// toJSON do not run. Hostile Proxy traps and modified native built-ins remain
// outside this same-process plain-data boundary.
function capture(input) {
  let nodes = 0, bytes = 0; const active = new WeakSet();
  function copy(value, depth) {
    bytes += 8; need(++nodes <= 100000 && depth <= 20 && bytes <= 8 * 1024 * 1024, 'LIMIT');
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number') { need(Number.isSafeInteger(value) && !Object.is(value, -0), 'INTEGER'); return value; }
    if (typeof value === 'string') {
      need(value.length <= 262144 && value.isWellFormed(), 'STRING');
      bytes += Buffer.byteLength(value, 'utf8'); need(bytes <= 8 * 1024 * 1024, 'LIMIT'); return value;
    }
    need(value !== null && typeof value === 'object', 'SCHEMA');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
    need(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null, 'PROTOTYPE');
    need(!active.has(value), 'CYCLE'); active.add(value);
    const keys = Reflect.ownKeys(value); let result;
    if (array) {
      const length = Object.getOwnPropertyDescriptor(value, 'length');
      need(length && Object.hasOwn(length, 'value') && Number.isSafeInteger(length.value)
        && length.value >= 0 && length.value <= 2048, 'LIMIT');
      need(keys.length === length.value + 1, 'SCHEMA'); result = [];
      for (let i = 0; i < length.value; i++) {
        const entry = Object.getOwnPropertyDescriptor(value, String(i));
        need(entry && entry.enumerable && Object.hasOwn(entry, 'value'), 'DESCRIPTOR'); result.push(copy(entry.value, depth + 1));
      }
    } else {
      need(keys.length <= 64 && keys.every(key => typeof key === 'string' && key.length <= 96 && key.isWellFormed()), 'SCHEMA');
      result = Object.create(null);
      for (const key of keys) {
        bytes += Buffer.byteLength(key, 'utf8'); need(bytes <= 8 * 1024 * 1024, 'LIMIT');
        const entry = Object.getOwnPropertyDescriptor(value, key);
        need(entry && entry.enumerable && Object.hasOwn(entry, 'value'), 'DESCRIPTOR'); result[key] = copy(entry.value, depth + 1);
      }
    }
    active.delete(value); return result;
  }
  return copy(input, 0);
}


function parseCall(value) {
  data(value); const selector = value.slice(0, 10), body = value.slice(10);
  const kind = Object.keys(CALL).find(key => CALL[key] === selector); need(kind, 'UNSUPPORTED_CALL');
  function at(i) { need(body.length >= (i + 1) * 64, 'ABI'); return BigInt('0x' + body.slice(i * 64, (i + 1) * 64)); }
  function addr(i) { const n = at(i); need(n < (1n << 160n), 'ABI'); return '0x' + n.toString(16).padStart(40, '0'); }
  if (kind === 'approve') { need(body.length === 128, 'ABI'); return { kind, to: addr(0), id: account(at(1)) }; }
  if (kind === 'operator') { need(body.length === 128 && at(1) <= 1n, 'ABI'); return { kind, operator: addr(0), allowed: at(1) === 1n }; }
  if (kind === 'safeData') {
    need(at(3) === 128n && at(4) <= 4096n, 'ABI'); const length = Number(at(4));
    const end = 320 + length * 2, padded = 320 + Math.ceil(length / 32) * 64;
    need(body.length === padded && /^0*(?![\s\S])/.test(body.slice(end)), 'ABI');
  } else need(body.length === 192, 'ABI');
  return { kind, from: addr(0), to: addr(1), id: account(at(2)) };
}
const transferLog = (registry, from, to, id) => ({ address: registry, topics: [SIG.transfer, topic(from), topic(to), topic(id + 1)], data: '0x' });
const approvalLog = (registry, from, to, id) => ({ address: registry, topics: [SIG.approval, topic(from), topic(to), topic(id + 1)], data: '0x' });

function replay(sequence, selection) {
  fields(selection, ['schema', 'profile', 'registry', 'firstOwner', 'secondOwner']);
  need(selection.schema === 'caw-registry-selection/1' && selection.profile === PROFILE, 'SCHEMA');
  const registry = address(selection.registry), first = address(selection.firstOwner), second = address(selection.secondOwner);
  need(Array.isArray(sequence) && sequence.length <= 256, 'SEQUENCE_LIMIT');
  const owners = [first, first, second], approved = [ZERO, ZERO, ZERO], epochs = [0n, 0n, 0n];
  const operators = new Map(), operations = []; let failed = 0;
  const operatorKey = (owner, operator) => owner + ':' + operator;
  const hasOperator = (owner, operator) => operators.get(operatorKey(owner, operator)) === true;
  for (const [index, entry] of sequence.entries()) {
    fields(entry, ['from', 'to', 'value', 'data', 'status', 'logs']);
    const caller = address(entry.from); need(entry.to === registry && entry.value === '0x0', 'DIRECT_CALL'); data(entry.data);
    need(entry.status === '0x0' || entry.status === '0x1', 'STATUS');
    need(Array.isArray(entry.logs) && entry.logs.length <= 2, 'LOGS');
    for (const log of entry.logs) {
      fields(log, ['address', 'topics', 'data']); address(log.address);
      need(Array.isArray(log.topics) && log.topics.length >= 1 && log.topics.length <= 4, 'LOGS');
      log.topics.forEach(t => need(typeof t === 'string' && /^0x[0-9a-f]{64}(?![\s\S])/.test(t), 'LOGS')); data(log.data, 32);
    }
    if (entry.status === '0x0') { need(entry.logs.length === 0, 'FAILED_LOGS'); failed++; continue; }
    const call = parseCall(entry.data); let expected, operation;
    if (call.kind === 'operator') {
      need(call.operator !== caller, 'SELF_OPERATOR');
      expected = [{ address: registry, topics: [SIG.operator, topic(caller), topic(call.operator)], data: topic(call.allowed ? 1 : 0) }];
      operation = { index, kind: call.kind, caller, operator: call.operator, allowed: call.allowed };
      operators.set(operatorKey(caller, call.operator), call.allowed);
    } else {
      const id = call.id, owner = owners[id];
      if (call.kind === 'approve') {
        need(caller === owner || hasOperator(owner, caller), 'NOT_AUTHORIZED');
        expected = [approvalLog(registry, owner, call.to, id)];
        approved[id] = call.to;
        operation = { index, kind: call.kind, caller, accountId: String(id + 1), owner, approved: call.to,
          authorization: caller === owner ? 'owner' : 'operator' };
      } else {
        need(call.from === owner, 'WRONG_FROM'); need(call.to !== ZERO, 'ZERO_RECIPIENT');
        const authorization = caller === owner ? 'owner' : caller === approved[id] ? 'token-approval' : hasOperator(owner, caller) ? 'operator' : null;
        need(authorization, 'NOT_AUTHORIZED'); need(epochs[id] < MAX, 'EPOCH_OVERFLOW');
        expected = [approvalLog(registry, owner, ZERO, id), transferLog(registry, owner, call.to, id)];
        operation = { index, kind: call.kind, caller, accountId: String(id + 1), from: owner, to: call.to,
          authorization, previousEpoch: String(epochs[id]), epoch: String(epochs[id] + 1n) };
        owners[id] = call.to; approved[id] = ZERO; epochs[id]++;
      }
    }
    // Full exact log comparison excludes extra/missing events and callback
    // effects; merely finding a matching event somewhere is insufficient.
    need(equal(entry.logs, expected), 'EVENTS'); operations.push(operation);
  }
  return { schema: 'caw-registry-call-sequence/1', profile: PROFILE, selection,
    operations, successfulCalls: operations.length, failedCallsNotPermissionChecked: failed,
    final: { owners, approved, epochs: epochs.map(String), operators: [...operators.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, allowed]) => {
      const [owner, operator] = key.split(':'); return { owner, operator, allowed };
    }) }, registryPermissionRulesVerified: true, senderVerified: false,
    initialStateAssumption: 'supplied-constructor-owners-zero-approvals-and-epochs', ...FLAGS };
}

/** Replay a supplied direct-call transcript. Senders and initial owners are
 * inputs here, not authenticated identities; use the history wrapper to bind
 * them to checked captures. Success means conditional fixture-rule consistency.
 * Safe-transfer callbacks, extra effects and noncanonical ABI aliases are out
 * of profile. A failed call has no state effect or inferred failure reason. */
export function inspectRegistryCallSequence(sequenceInput, selectionInput) {
  need(arguments.length === 2, 'SCHEMA');
  const { sequence, selection } = capture({ sequence: sequenceInput, selection: selectionInput });
  return freeze(replay(sequence, selection));
}

/** Add fixed registry permission replay to the unchanged body/post inspectors.
 * Pins identify retained byte strings, not authenticated deployed code/state.
 * Constructor execution, empty initial storage and direct-call msg.sender
 * semantics are conditional assumptions. No recovery adoption follows. */
export function inspectPaidRegistryHistory(historyInput, manifestInput, capturesInput, policyInput) {
  need(arguments.length === 4, 'SCHEMA');
  const { history, manifest, captures, policy } = capture({ history: historyInput, manifest: manifestInput, captures: capturesInput, policy: policyInput });
  const postHistory = inspectPaidPostHistory(history, manifest, captures, policy);
  const sha = hex => createHash('sha256').update(Buffer.from(hex.slice(2), 'hex')).digest('hex');
  need(sha(history.registry_runtime) === RUNTIME, 'RUNTIME_PIN');
  const registry = history.addresses.registry, sequence = [], positions = []; let selection = null;
  const compactLogs = logs => logs.map(({ address, topics, data }) => ({ address, topics, data }));
  for (const block of history.blocks) for (const { transaction: tx, receipt } of block.transactions) {
    if (receipt.status === '0x1' && receipt.contractAddress === registry) {
      need(selection === null && tx.to === null && tx.data.length === 2 + 3293 * 2 && sha(tx.data.slice(0, -128)) === CREATION, 'CREATION_PIN');
      const tail = tx.data.slice(-128);
      need(tail.slice(0, 24) === '0'.repeat(24) && tail.slice(64, 88) === '0'.repeat(24), 'CONSTRUCTOR');
      const first = address('0x' + tail.slice(24, 64)), second = address('0x' + tail.slice(88));
      selection = { schema: 'caw-registry-selection/1', profile: PROFILE, registry, firstOwner: first, secondOwner: second };
      need(equal(compactLogs(receipt.logs), [transferLog(registry, ZERO, first, 0), transferLog(registry, ZERO, first, 1), transferLog(registry, ZERO, second, 2)]), 'MINT_EVENTS');
    } else if (tx.to === registry) {
      need(selection !== null, 'ORDER');
      sequence.push({ from: tx.from, to: tx.to, value: tx.value, data: tx.data, status: receipt.status, logs: compactLogs(receipt.logs) });
      positions.push({ blockHash: block.header.hash, blockNumber: block.header.number, transactionHash: receipt.transactionHash });
    } else need(receipt.logs.every(log => log.address !== registry), 'INDIRECT_EVENT');
  }
  need(selection !== null, 'CREATION'); const checked = replay(sequence, selection);
  need(equal(checked.final.owners, postHistory.body_history.history.owners) && equal(checked.final.epochs, postHistory.body_history.history.epochs), 'FINAL');
  return freeze({ schema: 'caw-paid-registry-history/1', profile: PROFILE, post_history: postHistory,
    registry_sequence: checked, operations: checked.operations.map(op => ({ ...op, ...positions[op.index] })),
    registryPermissionRulesVerified: true, registryCallSendersBound: true, registryBytePinsMatched: true,
    registryExecutionAssumption: 'fixed-fixture-constructor-and-direct-call-semantics', ...FLAGS });
}
