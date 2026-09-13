// Bounded, offline sender recovery for committed London legacy/type-1/type-2
// transaction bytes. The existing header, canonical decoder, RLP admission,
// transaction trie and Keccak implementations are reused, not independently
// implemented here. Signing-preimage reconstruction and public-data curve
// arithmetic are new. No signing, private keys, transport or state execution.
// https://www.secg.org/sec1-v2.pdf (sections 4.1.4 and 4.1.6)
// https://www.secg.org/sec2-v2.pdf (section 2.4.1, secp256k1)
// https://eips.ethereum.org/EIPS/eip-2
// https://eips.ethereum.org/EIPS/eip-155
// https://eips.ethereum.org/EIPS/eip-2930
// https://eips.ethereum.org/EIPS/eip-1559
import { Buffer } from 'node:buffer';
import { keccak256Hex } from './keccak256.mjs';
import { inspectBlockTransactions } from './ethereum-block-transactions.mjs';

const LIMIT = Object.freeze({ bytes: 8 * 1024 * 1024, nodes: 100000, depth: 20,
  array: 2048, string: 262144 });
const P = 0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2fn;
const N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
const HALF_N = N >> 1n;
const INFINITY = Object.freeze([0n, 1n, 0n]);
const G = Object.freeze([
  0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798n,
  0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8n,
  1n,
]);
const FLAGS = Object.freeze({ transactionCommitmentVerified: true,
  signaturesVerified: true, senderVerified: true, transactionsVerified: false,
  executionVerified: false, endpointAuthenticated: false, consensusVerified: false,
  finalityVerified: false, freshnessVerified: false });

function fail(reason) {
  const error = new Error('Transaction senders rejected: ' + reason + '.');
  error.code = 'TRANSACTION_SENDER_' + reason;
  throw error;
}
function need(condition, reason) { if (!condition) fail(reason); }
function fields(value, required) {
  need(value !== null && typeof value === 'object' && !Array.isArray(value), 'SCHEMA');
  const allowed = new Set(required);
  need(Object.keys(value).every(key => allowed.has(key))
    && required.every(key => Object.hasOwn(value, key)), 'SCHEMA');
}

// Capture every argument together before using any field. Own enumerable data
// descriptors only: getters, toJSON and caller iterators never execute. As in
// the existing reader, hostile Proxy traps and replaced native built-ins are
// outside this same-process plain-data boundary.
function capture(input) {
  const budget = { bytes: 0, nodes: 0 }, active = new WeakSet();
  function copy(value, depth) {
    budget.bytes += 8;
    need(++budget.nodes <= LIMIT.nodes && depth <= LIMIT.depth && budget.bytes <= LIMIT.bytes, 'LIMIT');
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number') {
      need(Number.isSafeInteger(value) && !Object.is(value, -0), 'INTEGER');
      return value;
    }
    if (typeof value === 'string') {
      need(value.length <= LIMIT.string && value.isWellFormed(), 'STRING');
      budget.bytes += Buffer.byteLength(value, 'utf8');
      need(budget.bytes <= LIMIT.bytes, 'LIMIT');
      return value;
    }
    need(value !== null && typeof value === 'object', 'SCHEMA');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
    need(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null, 'PROTOTYPE');
    need(!active.has(value), 'CYCLE');
    active.add(value);
    const keys = Reflect.ownKeys(value);
    let result;
    if (array) {
      const length = Object.getOwnPropertyDescriptor(value, 'length');
      need(length && Object.hasOwn(length, 'value') && Number.isSafeInteger(length.value)
        && length.value >= 0 && length.value <= LIMIT.array, 'LIMIT');
      need(keys.length === length.value + 1, 'SCHEMA');
      result = [];
      for (let index = 0; index < length.value; index++) {
        const entry = Object.getOwnPropertyDescriptor(value, String(index));
        need(entry && entry.enumerable && Object.hasOwn(entry, 'value'), 'DESCRIPTOR');
        result.push(copy(entry.value, depth + 1));
      }
    } else {
      need(keys.length <= 64 && keys.every(key => typeof key === 'string'
        && key.length <= 96 && key.isWellFormed()), 'SCHEMA');
      result = Object.create(null);
      for (const key of keys) {
        budget.bytes += Buffer.byteLength(key, 'utf8');
        need(budget.bytes <= LIMIT.bytes, 'LIMIT');
        const entry = Object.getOwnPropertyDescriptor(value, key);
        need(entry && entry.enumerable && Object.hasOwn(entry, 'value'), 'DESCRIPTOR');
        result[key] = copy(entry.value, depth + 1);
      }
    }
    active.delete(value);
    return result;
  }
  return copy(input, 0);
}
function freeze(value) {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
function checkSelection(selection) {
  fields(selection, ['schema', 'profile', 'hash', 'chainId', 'allowUnprotectedLegacy']);
  need(selection.schema === 'caw-block-senders-selection/1', 'SCHEMA');
  need(selection.profile === 'london-16', 'PROFILE');
  need(typeof selection.hash === 'string' && /^0x[0-9a-f]{64}$/.test(selection.hash), 'HASH');
  need(typeof selection.chainId === 'string' && selection.chainId.length <= 66
    && /^0x(?:0|[1-9a-f][0-9a-f]*)$/.test(selection.chainId), 'CHAIN_ID');
  need(typeof selection.allowUnprotectedLegacy === 'boolean', 'UNPROTECTED_POLICY');
}

// These encoders receive only the existing decoder's canonical frozen fields.
// In particular, integer zero encodes as empty bytes, contract creation keeps
// its empty destination, and access-list order and duplicate entries survive.
function bytes(value) { return Buffer.from(value.slice(2), 'hex'); }
function uint(value) {
  const number = BigInt(value);
  if (number === 0n) return Buffer.alloc(0);
  const digits = number.toString(16);
  return Buffer.from(digits.padStart(digits.length + digits.length % 2, '0'), 'hex');
}
function wrap(payload, list = false) {
  if (!list && payload.length === 1 && payload[0] < 128) return payload;
  const base = list ? 192 : 128;
  if (payload.length < 56) return Buffer.concat([Buffer.from([base + payload.length]), payload]);
  const length = uint(payload.length);
  return Buffer.concat([Buffer.from([base + 55 + length.length]), length, payload]);
}
function rlpList(encoded) { return wrap(Buffer.concat(encoded), true); }
function accessList(entries) {
  return rlpList(entries.map(entry => rlpList([
    wrap(bytes(entry.address)), rlpList(entry.storageKeys.map(key => wrap(bytes(key)))),
  ])));
}
function signingPayload(transaction, selection) {
  const integer = name => wrap(uint(transaction[name]));
  const data = name => wrap(bytes(transaction[name]));
  let encoded, chainId, parity, replayProtected = true;
  if (transaction.type === '0x0') {
    const v = BigInt(transaction.v);
    const core = [integer('nonce'), integer('gasPrice'), integer('gasLimit'),
      data('to'), integer('value'), data('data')];
    if (v === 27n || v === 28n) {
      need(selection.allowUnprotectedLegacy, 'UNPROTECTED_LEGACY');
      chainId = null;
      replayProtected = false;
      parity = v - 27n;
      encoded = rlpList(core);
    } else {
      // The old canonical decoder has already refused legacy v below 35.
      need(v >= 35n, 'PARITY');
      parity = (v - 35n) & 1n;
      chainId = '0x' + ((v - 35n) >> 1n).toString(16);
      need(chainId === selection.chainId, 'CHAIN_MISMATCH');
      encoded = rlpList([...core, wrap(uint(chainId)), wrap(Buffer.alloc(0)), wrap(Buffer.alloc(0))]);
    }
  } else {
    chainId = transaction.chainId;
    need(chainId === selection.chainId, 'CHAIN_MISMATCH');
    parity = BigInt(transaction.yParity);
    let core;
    if (transaction.type === '0x1') {
      core = [integer('chainId'), integer('nonce'), integer('gasPrice'), integer('gasLimit'),
        data('to'), integer('value'), data('data'), accessList(transaction.accessList)];
    } else {
      need(transaction.type === '0x2', 'TYPE');
      core = [integer('chainId'), integer('nonce'), integer('maxPriorityFeePerGas'),
        integer('maxFeePerGas'), integer('gasLimit'), data('to'), integer('value'),
        data('data'), accessList(transaction.accessList)];
    }
    encoded = Buffer.concat([bytes(transaction.type === '0x1' ? '0x01' : '0x02'), rlpList(core)]);
  }
  need(parity === 0n || parity === 1n, 'PARITY');
  return { signingHash: keccak256Hex('0x' + encoded.toString('hex')), chainId, parity, replayProtected };
}

function mod(value, modulus = P) {
  const result = value % modulus;
  return result < 0n ? result + modulus : result;
}
function inverse(value, modulus) {
  let a = mod(value, modulus), b = modulus, x = 1n, y = 0n;
  need(a !== 0n, 'SIGNATURE');
  // For these <=256-bit operands Euclid takes fewer than 512 iterations.
  // Explicitly bound the loop as well as its inputs; no private data is used.
  for (let steps = 0; b !== 0n; steps++) {
    need(steps < 512, 'ARITHMETIC_LIMIT');
    const quotient = a / b;
    [a, b] = [b, a - quotient * b];
    [x, y] = [y, x - quotient * y];
  }
  need(a === 1n, 'SIGNATURE');
  return mod(x, modulus);
}
function squareRoot(value) {
  // secp256k1 p = 3 mod 4. This fixed exponent gives a candidate, which the
  // caller must check: a nonresidue must never become an accepted point.
  let base = value, exponent = (P + 1n) >> 2n, result = 1n;
  while (exponent > 0n) {
    if (exponent & 1n) result = mod(result * base);
    base = mod(base * base);
    exponent >>= 1n;
  }
  return result;
}

// Jacobian (X:Y:Z) represents affine (X/Z²,Y/Z³); Z=0 is infinity.
// Short-Weierstrass a=0 formulas. Operations branch on public transaction data
// and are intentionally not constant-time: they must never be used for keys.
function double(point) {
  const [x, y, z] = point;
  if (z === 0n || y === 0n) return INFINITY;
  const yy = mod(y * y), yyyy = mod(yy * yy);
  const slope = mod(3n * x * x), side = mod(4n * x * yy);
  const nx = mod(slope * slope - 2n * side);
  return [nx, mod(slope * (side - nx) - 8n * yyyy), mod(2n * y * z)];
}
function add(first, second) {
  const [x1, y1, z1] = first, [x2, y2, z2] = second;
  if (z1 === 0n) return second;
  if (z2 === 0n) return first;
  const z1z1 = mod(z1 * z1), z2z2 = mod(z2 * z2);
  const u1 = mod(x1 * z2z2), u2 = mod(x2 * z1z1);
  const s1 = mod(y1 * z2 * z2z2), s2 = mod(y2 * z1 * z1z1);
  const h = mod(u2 - u1), difference = mod(s2 - s1);
  if (h === 0n) return difference === 0n ? double(first) : INFINITY;
  const hh = mod(h * h), hhh = mod(h * hh), side = mod(u1 * hh);
  const nx = mod(difference * difference - hhh - 2n * side);
  return [nx, mod(difference * (side - nx) - s1 * hhh), mod(h * z1 * z2)];
}
function linearCombination(a, first, b, second) {
  // Coefficients are reduced modulo n before this fixed 256-bit joint loop.
  // Precomputing first+second needs at most one addition per bit. Recovery and
  // the separate ECDSA check each use one loop; no input controls its length.
  a = mod(a, N);
  b = mod(b, N);
  const combined = add(first, second);
  let result = INFINITY;
  for (let mask = 1n << 255n; mask !== 0n; mask >>= 1n) {
    result = double(result);
    const left = (a & mask) !== 0n, right = (b & mask) !== 0n;
    if (left && right) result = add(result, combined);
    else if (left) result = add(result, first);
    else if (right) result = add(result, second);
  }
  return result;
}
function affine(point, reason) {
  need(point[2] !== 0n, reason);
  const iz = inverse(point[2], P), iz2 = mod(iz * iz);
  const x = mod(point[0] * iz2), y = mod(point[1] * iz2 * iz);
  need(mod(y * y) === mod(x * x * x + 7n), reason);
  return [x, y, 1n];
}
function recover(signingHash, r, s, parity) {
  need(r > 0n && r < N, 'R');
  need(s > 0n && s < N, 'S');
  need(s <= HALF_N, 'HIGH_S');
  // Ethereum carries parity 0/1 only, so the recovery x-coordinate is r.
  // The general SEC 1 r+n candidate needs an extra recovery bit not supplied
  // by Ethereum; do not retry it. N<P, so validated r is a field element.
  const alpha = mod(r * r * r + 7n);
  let y = squareRoot(alpha);
  need(mod(y * y) === alpha, 'RECOVERY_POINT');
  if ((y & 1n) !== parity) y = mod(-y);
  need((y & 1n) === parity, 'RECOVERY_POINT');
  const recoveryPoint = [r, y, 1n], z = BigInt(signingHash);
  // SEC 2 fixes prime order n and cofactor 1: every validated finite point on
  // this curve is in that subgroup. An additional nR multiplication adds no
  // validation here; reducing n in our scalar routine would make it vacuous.
  const rInverse = inverse(r, N);
  const publicPoint = affine(linearCombination(s * rInverse, recoveryPoint,
    -z * rInverse, G), 'PUBLIC_KEY');

  // Separately verify the ECDSA equation against the recovered public key.
  // This is a second check using the same arithmetic, not an independent ECC
  // implementation or evidence that an externally named identity authorized.
  const sInverse = inverse(s, N);
  const checked = affine(linearCombination(z * sInverse, G,
    r * sInverse, publicPoint), 'SIGNATURE');
  need(checked[0] % N === r, 'SIGNATURE');
  const coordinates = publicPoint[0].toString(16).padStart(64, '0')
    + publicPoint[1].toString(16).padStart(64, '0');
  return { publicKey: '0x04' + coordinates,
    from: '0x' + keccak256Hex('0x' + coordinates).slice(-40) };
}

/** Verify transaction commitments and recover each sender under an explicit
 * chain policy. The selected header and chain remain caller assumptions.
 * No RPC sender/hash labels, receipt association, CAW authority, state
 * execution, endpoint authenticity, consensus, finality or time are verified.
 */
export function inspectBlockSenders(headerInput, rawTransactionsInput, selectionInput) {
  need(arguments.length === 3, 'SCHEMA');
  const supplied = capture({ header: headerInput, rawTransactions: rawTransactionsInput,
    selection: selectionInput });
  const { header, rawTransactions, selection } = supplied;
  checkSelection(selection);
  // Old admission limits still apply: <=256 transactions, <=16 KiB per raw
  // envelope, <=1 MiB aggregate bytes, <=8 KiB calldata and bounded access
  // lists. Its original errors and nested false verification flags survive.
  const bodyIntegrity = inspectBlockTransactions(header, rawTransactions, {
    schema: 'caw-block-transactions-selection/1', profile: selection.profile, hash: selection.hash,
  });
  const transactions = bodyIntegrity.transactions.map(transaction => {
    const signing = signingPayload(transaction, selection);
    const sender = recover(signing.signingHash, BigInt(transaction.r), BigInt(transaction.s), signing.parity);
    return { ...transaction, ...sender, signingHash: signing.signingHash,
      replayProtected: signing.replayProtected, chainId: signing.chainId };
  });
  return freeze({ schema: 'caw-block-senders-integrity/1', profile: selection.profile,
    chainId: selection.chainId, blockHash: bodyIntegrity.blockHash,
    blockNumber: bodyIntegrity.blockNumber, transactionCount: transactions.length,
    body_integrity: bodyIntegrity, transactions, ...FLAGS });
}
