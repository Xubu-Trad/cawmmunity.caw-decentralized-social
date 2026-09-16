// Offline EOA-signature checks for the fixed paid-action experiment. The
// domain/schema follow its unchanged contract; supplied owner/code assumptions
// do not become account state, ERC-1271, execution or consensus proofs.
import { Buffer } from 'node:buffer';
import { keccak256Hex } from './keccak256.mjs';
import { inspectDigestSignature } from './ethereum-block-senders.mjs';
import { inspectPaidBodyHistory } from './paid-body-history.mjs';

const PROFILE = 'paid-action-v1-eoa-65-low-s';
const FEE = 5000000000000000000000n;
const ZERO = '0x' + '00'.repeat(20);
const hashText = text => keccak256Hex('0x' + Buffer.from(text, 'utf8').toString('hex'));
const DOMAIN_TYPE = hashText('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)');
const NAME = hashText('CAW Paid Action Experiment'), VERSION = hashText('1');
const POST_TYPE = hashText('Post(uint256 accountId,uint256 epoch,uint256 nonce,uint256 validAfter,uint256 deadline,bytes32 distributionHash,bytes32 textHash,uint256 fee,bytes32 profile)');
const CONTRACT_PROFILE = hashText('CAW_PAID_ACTION_THREE_ID_POOL_LOCKED_STAKE_UTF8_SCALARS_V1');
const POST_CALL = hashText('post((uint256,uint256,uint256,uint256,uint256,bytes32,bytes),bytes)').slice(0, 10);
const POST_EVENT = hashText('Posted(uint256,uint256,address,uint256,uint256,bytes,uint256,bytes32,uint256,uint256,uint256,uint256)');
const word = value => BigInt(value).toString(16).padStart(64, '0');
const wordHash = words => keccak256Hex('0x' + words.join(''));
const FLAGS = Object.freeze({ accountAuthorityVerified: false, codeAbsenceVerified: false,
  erc1271Verified: false, executionVerified: false, endpointAuthenticated: false,
  consensusVerified: false, finalityVerified: false, freshnessVerified: false });

function fail(code) { const e = new Error('Paid post signature rejected: ' + code + '.'); e.code = 'PAID_POST_SIGNATURE_' + code; throw e; }
function need(value, code) { if (!value) fail(code); }
function fields(value, required) {
  need(value !== null && typeof value === 'object' && !Array.isArray(value), 'SCHEMA');
  need(Object.keys(value).length === required.length && required.every(k => Object.hasOwn(value, k)), 'SCHEMA');
}
function address(value) { need(typeof value === 'string' && /^0x[0-9a-f]{40}(?![\s\S])/.test(value) && value !== ZERO, 'ADDRESS'); return value; }
function quantity(value) { need(typeof value === 'string' && /^0x(?:0|[1-9a-f][0-9a-f]{0,63})(?![\s\S])/.test(value), 'QUANTITY'); return BigInt(value); }
function freeze(value) { if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }

// Adapted from the existing plain-data boundary. All arguments detach together
// before inspection; no accessors, toJSON or supplied iterators execute. Proxy
// traps and modified native built-ins remain outside this same-process model.
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
  need(typeof value === 'string' && value.length <= 2 + 8192 * 2 && /^0x(?:[0-9a-f]{2})*(?![\s\S])/.test(value), 'CALLDATA');
  need(value.slice(0, 10) === POST_CALL, 'SELECTOR');
  const bytes = Buffer.from(value.slice(10), 'hex');
  function at(offset) {
    need(Number.isSafeInteger(offset) && offset >= 0 && offset + 32 <= bytes.length, 'ABI');
    return BigInt('0x' + bytes.subarray(offset, offset + 32).toString('hex'));
  }
  function dynamic(offset, maximum) {
    const length = at(offset); need(length <= BigInt(maximum), 'ABI');
    const end = offset + 32 + Number(length), padded = offset + 32 + Math.ceil(Number(length) / 32) * 32;
    need(padded <= bytes.length && bytes.subarray(end, padded).every(x => x === 0), 'ABI');
    return { value: '0x' + bytes.subarray(offset + 32, end).toString('hex'), padded };
  }
  // Require the canonical two-argument ABI layout, with contiguous tails and
  // zero padding. This deliberately does not admit every permissive ABI alias.
  need(at(0) === 64n && at(256) === 224n, 'ABI');
  const text = dynamic(288, 1680); need(at(32) === BigInt(text.padded), 'ABI');
  const signature = dynamic(text.padded, 65); need(signature.value.length === 132 && signature.padded === bytes.length, 'SIGNATURE_LENGTH');
  const textBytes = Buffer.from(text.value.slice(2), 'hex'); let decoded;
  try { decoded = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(textBytes); } catch { fail('TEXT'); }
  need(Buffer.from(decoded, 'utf8').equals(textBytes) && [...decoded].length >= 1 && [...decoded].length <= 420, 'TEXT');
  const accountId = at(64); need(accountId >= 1n && accountId <= 3n, 'ACCOUNT');
  return { request: { accountId: String(accountId), epoch: String(at(96)), nonce: String(at(128)),
    validAfter: String(at(160)), deadline: String(at(192)),
    distributionHash: '0x' + bytes.subarray(224, 256).toString('hex'), text: text.value }, signature: signature.value };
}

function inspectCaptured(calldata, selection) {
  fields(selection, ['schema', 'profile', 'chainId', 'verifyingContract', 'expectedSigner']);
  need(selection.schema === 'caw-paid-post-selection/1' && selection.profile === PROFILE, 'SCHEMA');
  const chain = quantity(selection.chainId), contract = address(selection.verifyingContract), expected = address(selection.expectedSigner);
  const { request, signature } = parseCall(calldata);
  const domainSeparator = wordHash([DOMAIN_TYPE.slice(2), NAME.slice(2), VERSION.slice(2), word(chain), word(contract)]);
  const textHash = keccak256Hex(request.text);
  const structHash = wordHash([POST_TYPE.slice(2), word(request.accountId), word(request.epoch), word(request.nonce),
    word(request.validAfter), word(request.deadline), request.distributionHash.slice(2), textHash.slice(2), word(FEE), CONTRACT_PROFILE.slice(2)]);
  const digest = keccak256Hex('0x1901' + domainSeparator.slice(2) + structHash.slice(2));
  const signatureIntegrity = inspectDigestSignature(digest, signature);
  need(signatureIntegrity.from === expected, 'SIGNER_MISMATCH');
  return { schema: 'caw-paid-post-signature/1', profile: PROFILE, selection, request,
    signature, textHash, domainSeparator, structHash, digest, signature_integrity: signatureIntegrity,
    signer: signatureIntegrity.from, signatureVerified: true, signerMatchesExpected: true,
    currentPermissionVerified: false, ...FLAGS };
}

/** Verify exact EIP-712 bytes against a separately supplied expected signer.
 * No signing, code-absence check, state/nonce/time validation or ERC-1271 call.
 * Even a valid expired/stale signature can pass this mathematical inspection. */
export function inspectPaidPostSignature(calldataInput, selectionInput) {
  need(arguments.length === 2, 'SCHEMA');
  const { calldata, selection } = capture({ calldata: calldataInput, selection: selectionInput });
  return freeze(inspectCaptured(calldata, selection));
}

/** Bind successful Posted records to their reconstructed historical owners,
 * under an explicit caller-supplied ordinary-account assumption. Failed calls
 * are outside this signature-acceptance report; they may revert before the
 * signature check. No saved-result adoption or current retry decision follows. */
export function inspectPaidPostHistory(historyInput, manifestInput, capturesInput, policyInput) {
  need(arguments.length === 4, 'SCHEMA');
  const { history, manifest, captures, policy } = capture({ history: historyInput,
    manifest: manifestInput, captures: capturesInput, policy: policyInput });
  fields(policy, ['schema', 'profile', 'assumedEoaOwners']);
  need(policy.schema === 'caw-paid-post-policy/1' && policy.profile === PROFILE, 'SCHEMA');
  need(Array.isArray(policy.assumedEoaOwners) && policy.assumedEoaOwners.length <= 64, 'OWNER_LIMIT');
  policy.assumedEoaOwners.forEach(address);
  const owners = new Set(policy.assumedEoaOwners); need(owners.size === policy.assumedEoaOwners.length, 'DUPLICATE_OWNER');
  const bodyHistory = inspectPaidBodyHistory(history, manifest, captures);
  const messages = bodyHistory.history.messages, posts = []; let failedPostCalls = 0;
  for (const block of history.blocks) for (const { transaction: tx, receipt } of block.transactions) {
    if (tx.to !== history.addresses.probe || !tx.data.startsWith(POST_CALL)) continue;
    if (receipt.status === '0x0') { failedPostCalls++; continue; }
    const events = receipt.logs.filter(log => log.address === history.addresses.probe && log.topics[0] === POST_EVENT);
    need(events.length === 1, 'POST_EVENT');
    const message = messages[posts.length];
    need(message && message.id === String(BigInt(events[0].topics[1])), 'MESSAGE_ORDER');
    need(owners.has(message.owner), 'OWNER_ASSUMPTION');
    const signature = inspectCaptured(tx.data, { schema: 'caw-paid-post-selection/1', profile: PROFILE,
      chainId: '0x7a69', verifyingContract: history.addresses.probe, expectedSigner: message.owner });
    need(signature.request.accountId === message.accountId && signature.request.epoch === message.epoch
      && signature.request.nonce === message.nonce && signature.request.text === message.text_hex
      && signature.request.distributionHash === message.distributionHash, 'MESSAGE_BINDING');
    posts.push({ messageId: message.id, blockHash: block.header.hash, blockNumber: block.header.number,
      transactionHash: receipt.transactionHash, relayer: tx.from, owner: message.owner, signature });
  }
  need(posts.length === messages.length, 'MESSAGE_COUNT');
  return freeze({ schema: 'caw-paid-post-history/1', profile: PROFILE, policy, body_history: bodyHistory,
    posts, successfulPostCount: posts.length, failedPostCallsNotSignatureChecked: failedPostCalls,
    postSignaturesVerified: true, historicalOwnerMatchesVerified: true,
    ownerCodeAssumption: 'caller-supplied-eoa', currentPermissionVerified: false, ...FLAGS });
}
