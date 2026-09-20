import test from 'node:test';
import assert from 'node:assert/strict';
import { BOUNDED_JSON_LIMITS, parseBoundedJson, readBoundedJson } from '../public/bounded-json.mjs';

// Deterministic parser and native Response/ReadableStream tests only. No fetch,
// service, hostile Proxy, replacement built-in or randomized corpus is used.
const encoder = new TextEncoder();
const bytes = text => encoder.encode(text);
const code = expected => error => error instanceof Error && error.code === 'BOUNDED_JSON_' + expected;
const reject = (fn, expected) => assert.throws(fn, code(expected));
const rejectAsync = (fn, expected) => assert.rejects(fn, code(expected));

function streamed(chunks, { keepOpen = false, cancelError = null, status = 200, readError = null, headers } = {}) {
  const stats = { pulls: 0, cancelled: 0 };
  let index = 0;
  const stream = new ReadableStream({
    pull(controller) {
      stats.pulls++;
      if (index < chunks.length) {
        controller.enqueue(chunks[index++]);
        if (index === chunks.length && !keepOpen && !readError) controller.close();
      } else if (readError) {
        throw readError;
      } else if (keepOpen) {
        // Bound a faulty consumer too: it should reject the supplied bad chunk
        // before asking this deliberately open test source for another one.
        throw new Error('Unexpected read beyond the rejected test chunk.');
      } else controller.close();
    },
    cancel() {
      stats.cancelled++;
      if (cancelError) throw cancelError;
    }
  }, { highWaterMark: 0 });
  const response = new Response(stream, { status, headers });
  return { response, stream, stats };
}

test('published parser limits are fixed and immutable', () => {
  assert.deepEqual(BOUNDED_JSON_LIMITS, { maxBytes: 1048576, maxDepth: 32, maxItems: 100000 });
  assert.ok(Object.isFrozen(BOUNDED_JSON_LIMITS));
  assert.throws(() => { BOUNDED_JSON_LIMITS.maxDepth = Infinity; }, TypeError);
});

test('only primitive strings are accepted without invoking coercion hooks', () => {
  let calls = 0;
  const convertible = { toString() { calls++; return '{}'; }, valueOf() { calls++; return '{}'; } };
  for (const value of [null, undefined, true, 0, 1n, Symbol('json'), {}, [], new String('{}'), bytes('{}'), convertible])
    reject(() => parseBoundedJson(value), 'TYPE');
  assert.equal(calls, 0);
});

test('byte budgets require an integer from one through one MiB', () => {
  for (const limit of [null, false, '10', 0, -1, 0.5, 1.5, NaN, Infinity, -Infinity, 1048577, 1n, {}])
    reject(() => parseBoundedJson('0', limit), 'LIMIT');
  assert.equal(parseBoundedJson('0', 1), 0);
  assert.equal(parseBoundedJson('0', undefined), 0);
  assert.equal(parseBoundedJson('0', 1048576), 0);
});

test('ordinary valid JSON has the same result and prototypes as native parsing', () => {
  const cases = [
    'null', 'true', 'false', '0', '[]', '{}', '""', '"CAW"',
    ' \t\r\n { "a" : [true, false, null, -2.5], "b": {"c": "value"} } \n',
    '{"a":[{},[],[null]],"b":"slashes / and quotes \\\""}',
    String.raw`{"escaped":"\b\f\n\r\t\/\\\"","unicode":"\u0041\u03bb"}`,
    '{"line":"\u2028\u2029","text":"é é λ 中 🪶"}',
    '[{"same":1},{"same":2}]', '{"outer":{"outer":{"outer":0}}}'
  ];
  for (const text of cases) assert.deepEqual(parseBoundedJson(text), JSON.parse(text), text);
  assert.equal(Object.getPrototypeOf(parseBoundedJson('{}')), Object.prototype);
  assert.equal(Object.getPrototypeOf(parseBoundedJson('[]')), Array.prototype);
});

test('native numeric semantics are retained including negative zero overflow and rounding', () => {
  for (const text of ['-0', '-0.0', '0.25', '1E-3', '-123.5e+12', '1e400', '-1e400',
    '1e-4000', '-1e-4000', '9007199254740993', '123456789012345678901234567890'])
    assert.ok(Object.is(parseBoundedJson(text), JSON.parse(text)), text);
  assert.ok(Object.is(parseBoundedJson('-0'), -0));
  assert.equal(parseBoundedJson('1e400'), Infinity);
  assert.deepEqual(parseBoundedJson('[-0,1e400,9007199254740993]'), JSON.parse('[-0,1e400,9007199254740993]'));
});

test('Unicode escapes and lone UTF-16 surrogates are not normalized or replaced in string input', () => {
  const cases = [String.raw`"\ud800"`, String.raw`"\udfff"`, '"' + '\ud800' + '"',
    '"' + '\udfff' + '"', String.raw`"\uD83D\uDE80"`, '"🚀"', '"é"', '"é"'];
  for (const text of cases) assert.equal(parseBoundedJson(text), JSON.parse(text));
  const result = parseBoundedJson('{"é":1,"e\\u0301":2,"\\ud800":3,"\\ud801":4}');
  assert.equal(Object.keys(result).length, 4);
  assert.equal(result['é'], 1); assert.equal(result['é'], 2);
  assert.equal(result['\ud800'], 3); assert.equal(result['\ud801'], 4);
});

test('duplicate detection is per object rather than shared across ancestors or siblings', () => {
  for (const text of ['{"x":{"x":1},"y":{"x":2}}', '[{"x":1},{"x":2},{"x":3}]',
    '{"a":{"\\u0061":0},"b":{"a":1}}'])
    assert.deepEqual(parseBoundedJson(text), JSON.parse(text));
});

test('repeated decoded member names reject literal escaped and surrogate-pair aliases', () => {
  const aliases = [
    ['a', 'a'], ['a', String.raw`\u0061`], [String.raw`\u0061`, 'a'],
    ['ab', String.raw`a\u0062`], ['', ''], ['/', String.raw`\/`],
    [String.raw`\\`, String.raw`\u005c`],
    ['🚀', String.raw`\uD83D\uDE80`], [String.raw`\uD83D\uDE80`, String.raw`\ud83d\ude80`],
    ['\ud800', String.raw`\uD800`], [String.raw`\u0000`, String.raw`\u0000`],
    ['__proto__', '__proto__'], ['constructor', String.raw`constr\u0075ctor`]
  ];
  for (const [first, second] of aliases) {
    const text = '{"' + first + '":0,"' + second + '":1}';
    assert.equal(Object.keys(JSON.parse(text)).length, 1, 'the aliases actually decode to one native key');
    reject(() => parseBoundedJson(text), 'DUPLICATE_KEY');
  }
  reject(() => parseBoundedJson('{"nested":[{"same":0,"same":1}]}'), 'DUPLICATE_KEY');
});

test('__proto__ and inherited-name spellings remain own data without changing prototypes', () => {
  const text = '{"__proto__":{"boundedJsonOwnPropertySentinel":true},"constructor":1,"toString":2,"hasOwnProperty":3}';
  const result = parseBoundedJson(text);
  assert.deepEqual(result, JSON.parse(text)); assert.ok(Object.hasOwn(result, '__proto__'));
  assert.equal(Object.getPrototypeOf(result), Object.prototype);
  assert.equal(result.__proto__.boundedJsonOwnPropertySentinel, true);
  assert.equal(Object.prototype.boundedJsonOwnPropertySentinel, undefined);
  assert.equal(({}).boundedJsonOwnPropertySentinel, undefined);
});

test('strict grammar rejects malformed numbers delimiters literals escapes and trailing content', () => {
  const invalid = ['', ' ', '+1', '01', '-01', '.1', '1.', '1e', '1e+', '--1', '0x10',
    'NaN', 'Infinity', 'undefined', 'True', 'nul', 'truefalse', 'null 0', '[]{}',
    '[1,]', '[,1]', '[1,,2]', '[1 2]', '{a:1}', '{"a"}', '{"a":}', '{"a" 1}',
    '{"a":1,}', '{"a":1 "b":2}', '{"a":1} trailing', '"unfinished',
    String.raw`"\q"`, String.raw`"\x41"`, String.raw`"\v"`, String.raw`"\u12x4"`,
    String.raw`"\u123"`, String.raw`"\u"`, '"trailing\\', '\u00a0null', '\u2028null', '\vnull', '\fnull'];
  for (const text of invalid) {
    assert.throws(() => JSON.parse(text), SyntaxError, 'invalid corpus agrees with native syntax');
    reject(() => parseBoundedJson(text), 'SYNTAX');
  }
});

test('all unescaped control characters are rejected inside strings while their Unicode escapes work', () => {
  for (let value = 0; value < 32; value++) {
    reject(() => parseBoundedJson('"a' + String.fromCharCode(value) + 'b"'), 'SYNTAX');
    const escaped = '"a\\u' + value.toString(16).padStart(4, '0') + 'b"';
    assert.equal(parseBoundedJson(escaped), 'a' + String.fromCharCode(value) + 'b');
  }
});

test('structural-looking text and escaped quotes do not count as containers or member separators', () => {
  const value = { text: '{"duplicate":0,"duplicate":1}', brackets: '[{'.repeat(64),
    quote: '\\" , } ] \\ end', empty: '' };
  const text = JSON.stringify(value); assert.deepEqual(parseBoundedJson(text), value);
});

test('container depth32 succeeds and33 fails for arrays objects and mixed nesting', () => {
  for (const kind of ['array', 'object', 'mixed']) {
    const wrap = (text, index) => kind === 'array' || kind === 'mixed' && index % 2 === 0
      ? '[' + text + ']' : '{"x":' + text + '}';
    let text = '0'; for (let index = 0; index < 32; index++) text = wrap(text, index);
    assert.deepEqual(parseBoundedJson(text), JSON.parse(text));
    reject(() => parseBoundedJson(wrap(text, 32)), 'LIMIT');
  }
  assert.deepEqual(parseBoundedJson('['.repeat(32) + ']'.repeat(32)), JSON.parse('['.repeat(32) + ']'.repeat(32)));
});

test('the root array and all its values count toward the100000-item boundary', () => {
  const allowed = '[' + '0,'.repeat(99998) + '0]';
  const result = parseBoundedJson(allowed);
  assert.equal(result.length, 99999); assert.equal(result[0], 0); assert.equal(result.at(-1), 0);
  reject(() => parseBoundedJson('[' + '0,'.repeat(99999) + '0]'), 'LIMIT');
});

test('member names consume items as well as object containers and their values', () => {
  //49999 members give99999 items; replacing one scalar with[0] adds exactly1.
  const members = Array.from({ length: 49999 }, (_, index) => '"k' + index + '":0');
  members[0] = '"k0":[0]';
  const allowed = '{' + members.join(',') + '}';
  assert.ok(bytes(allowed).length < BOUNDED_JSON_LIMITS.maxBytes);
  const result = parseBoundedJson(allowed); assert.equal(Object.keys(result).length, 49999); assert.deepEqual(result.k0, [0]);
  members[0] = '"k0":[0,0]'; reject(() => parseBoundedJson('{' + members.join(',') + '}'), 'LIMIT');
});

test('the default byte ceiling is inclusive and counts surrounding whitespace', () => {
  const maximum = BOUNDED_JSON_LIMITS.maxBytes, allowed = '"' + 'x'.repeat(maximum - 2) + '"';
  assert.equal(parseBoundedJson(allowed).length, maximum - 2);
  reject(() => parseBoundedJson('"' + 'x'.repeat(maximum - 1) + '"'), 'LIMIT');
  assert.equal(parseBoundedJson('0 ', 2), 0); reject(() => parseBoundedJson('0 ', 1), 'LIMIT');
});

test('text byte caps use UTF-8 bytes rather than UTF-16 code-unit length', () => {
  for (const text of ['"é"', '"🪶"', '{"λ":"中"}', '"' + '\ud800' + '"']) {
    const length = bytes(text).length; assert.ok(length > text.length);
    assert.deepEqual(parseBoundedJson(text, length), JSON.parse(text));
    reject(() => parseBoundedJson(text, length - 1), 'LIMIT');
  }
});

test('a BOM is rejected as JSON syntax rather than silently removed from string input', () => {
  for (const text of ['\ufeffnull', ' \ufeff{}', 'null\ufeff']) reject(() => parseBoundedJson(text), 'SYNTAX');
  assert.equal(parseBoundedJson('"\ufeff"'), '\ufeff');
});

test('native streamed UTF-8 may split multibyte code points and include empty chunks', async () => {
  const text = ' \n{"text":"é é 中 🪶","escaped":"\\ud800","number":-0}\t';
  const encoded = bytes(text), chunks = [new Uint8Array(0), ...Array.from(encoded, value => Uint8Array.of(value)), new Uint8Array(0)];
  const { response, stream } = streamed(chunks);
  assert.deepEqual(await readBoundedJson(response, encoded.length), JSON.parse(text));
  assert.equal(stream.locked, false);
});

test('stream limits accept the exact bytes and reject one extra byte before any further read', async () => {
  const text = '{"x":"🪶"}', encoded = bytes(text);
  const exact = streamed([encoded.subarray(0, 3), encoded.subarray(3)]);
  assert.deepEqual(await readBoundedJson(exact.response, encoded.length), JSON.parse(text)); assert.equal(exact.stream.locked, false);
  const excess = streamed([encoded, bytes(' ')], { keepOpen: true });
  await rejectAsync(() => readBoundedJson(excess.response, encoded.length), 'LIMIT');
  assert.equal(excess.stats.pulls, 2); assert.equal(excess.stats.cancelled, 1); assert.equal(excess.stream.locked, false);
});

test('an oversized chunk cancels and releases even when cancellation fails without masking the size error', async () => {
  const cancellation = new Error('secondary cancellation failure');
  const record = streamed([bytes('0 ')], { keepOpen: true, cancelError: cancellation });
  await rejectAsync(() => readBoundedJson(record.response, 1), 'LIMIT');
  assert.equal(record.stats.pulls, 1); assert.equal(record.stats.cancelled, 1); assert.equal(record.stream.locked, false);
});

test('fatal UTF-8 rejects illegal sequences overlong encodings surrogate encodings and incomplete endings', async () => {
  const invalid = [
    [0x22, 0xff, 0x22], [0x22, 0xc0, 0xaf, 0x22], [0x22, 0xc3, 0x28, 0x22],
    [0x22, 0xed, 0xa0, 0x80, 0x22], [0x22, 0xf4, 0x90, 0x80, 0x80, 0x22],
    [0x22, 0xe2, 0x82], [0x22, 0xf0, 0x9f, 0x22]
  ];
  for (const payload of invalid) {
    const record = streamed(payload.map(value => Uint8Array.of(value)));
    await rejectAsync(() => readBoundedJson(record.response, 128), 'SYNTAX'); assert.equal(record.stream.locked, false);
  }
});

test('a split UTF-8 BOM remains visible to grammar while a BOM inside a string remains ordinary content', async () => {
  const leading = streamed([Uint8Array.of(0xef), Uint8Array.of(0xbb), Uint8Array.of(0xbf), bytes('{}')]);
  await rejectAsync(() => readBoundedJson(leading.response, 16), 'SYNTAX'); assert.equal(leading.stream.locked, false);
  assert.equal(await readBoundedJson(new Response('"\ufeff"'), 16), '\ufeff');
});

test('a native stream read error retains its original identity and releases the reader lock', async () => {
  const primary = new Error('original read failure'), record = streamed([bytes('{')], { readError: primary });
  await assert.rejects(readBoundedJson(record.response, 128), error => error === primary);
  assert.equal(record.stream.locked, false);
});

test('HTTP failure cancels an unread response and does not expose a secondary cleanup error', async () => {
  const record = streamed([bytes('{"ignored":true}')], { keepOpen: true, status: 503, cancelError: new Error('cleanup failure') });
  await rejectAsync(() => readBoundedJson(record.response, 128), 'TYPE');
  assert.equal(record.stats.pulls, 0); assert.equal(record.stats.cancelled, 1); assert.equal(record.stream.locked, false);
  await rejectAsync(() => readBoundedJson(new Response(null, { status: 204 }), 128), 'TYPE');
});

test('duplicate decoded keys and malformed JSON remain rejected after stream collection and lock release', async () => {
  const duplicate = String.raw`{"a":0,"\u0061":1}`;
  const record = streamed(Array.from(bytes(duplicate), value => Uint8Array.of(value)));
  await rejectAsync(() => readBoundedJson(record.response, 128), 'DUPLICATE_KEY'); assert.equal(record.stream.locked, false);
  const malformed = streamed([bytes('{"x":'), bytes(']')]);
  await rejectAsync(() => readBoundedJson(malformed.response, 128), 'SYNTAX'); assert.equal(malformed.stream.locked, false);
});

test('each accepted stream chunk is detached before a source reuses its backing buffer', async () => {
  const input = bytes('[1,2]'), buffer = new Uint8Array(1); let index = 0;
  const stream = new ReadableStream({
    pull(controller) {
      buffer[0] = input[index++]; controller.enqueue(buffer);
      if (index === input.length) controller.close();
    }
  }, { highWaterMark: 0 });
  assert.deepEqual(await readBoundedJson(new Response(stream), input.length), [1, 2]);
  assert.equal(stream.locked, false);
});

test('a non-byte chunk is refused and cleaned up through the native stream surface', async () => {
  const record = streamed(['0'], { keepOpen: true });
  await rejectAsync(() => readBoundedJson(record.response, 128), 'TYPE');
  assert.equal(record.stats.cancelled, 1); assert.equal(record.stream.locked, false);
});

test('actual response bytes enforce the cap regardless of Content-Length metadata', async () => {
  const allowed = streamed([bytes('{"x":1}')], { headers: { 'Content-Length': '1' } });
  assert.deepEqual(await readBoundedJson(allowed.response, 7), { x: 1 });
  const excess = streamed([bytes('0 ')], { keepOpen: true, headers: { 'Content-Length': '1' } });
  await rejectAsync(() => readBoundedJson(excess.response, 1), 'LIMIT'); assert.equal(excess.stream.locked, false);
});

test('streamed JSON retains native number and escaped-surrogate semantics', async () => {
  const text = String.raw`{"numbers":[-0,1e400,9007199254740993],"surrogate":"\ud800","__proto__":{"x":1}}`;
  const value = await readBoundedJson(new Response(text), bytes(text).length);
  assert.deepEqual(value, JSON.parse(text)); assert.ok(Object.is(value.numbers[0], -0));
  assert.equal(value.surrogate.charCodeAt(0), 0xd800); assert.equal(Object.getPrototypeOf(value), Object.prototype);
});
