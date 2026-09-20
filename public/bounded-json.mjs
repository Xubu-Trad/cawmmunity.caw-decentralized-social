// JSON syntax and resource checks only. Callers still validate domain values.
export const BOUNDED_JSON_LIMITS = Object.freeze({
  maxBytes: 1048576,
  maxDepth: 32,
  maxItems: 100000
});

function fail(kind) {
  const error = new Error('JSON input rejected: ' + kind + '.');
  error.code = 'BOUNDED_JSON_' + kind;
  throw error;
}

function byteLimit(maxBytes) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > BOUNDED_JSON_LIMITS.maxBytes) {
    fail('LIMIT');
  }
  return maxBytes;
}

/** Reject ambiguity before native parsing constructs the resulting objects.
 * Values retain JSON.parse semantics, including -0, exponents and escaped
 * strings. Duplicate names compare decoded strings without normalization.
 * Items count each value (containers included) and each object member name.
 */
export function parseBoundedJson(text, maxBytes = BOUNDED_JSON_LIMITS.maxBytes) {
  if (typeof text !== 'string') fail('TYPE');
  byteLimit(maxBytes);
  // UTF-16 length is a cheap lower bound on this UTF-8 byte count. Bound the
  // encoder's input before allocating its at-most-three-byte-per-unit result.
  if (text.length > maxBytes || new TextEncoder().encode(text).byteLength > maxBytes) fail('LIMIT');
  let position = 0;
  let items = 0;

  function item() {
    if (++items > BOUNDED_JSON_LIMITS.maxItems) fail('LIMIT');
  }

  function whitespace() {
    while (position < text.length) {
      const code = text.charCodeAt(position);
      if (code !== 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) break;
      position++;
    }
  }

  function string() {
    if (text.charCodeAt(position) !== 0x22) fail('SYNTAX');
    const start = position++;
    while (position < text.length) {
      const code = text.charCodeAt(position);
      if (code === 0x22) {
        position++;
        try { return JSON.parse(text.slice(start, position)); }
        catch { fail('SYNTAX'); }
      }
      // Skip an escaped code unit when finding the closing quote. The native
      // string-token parser checks escape spelling and control characters.
      position += code === 0x5c ? 2 : 1;
    }
    fail('SYNTAX');
  }

  function digit() {
    const code = text.charCodeAt(position);
    return code >= 0x30 && code <= 0x39;
  }

  function number() {
    if (text[position] === '-') position++;
    if (text[position] === '0') position++;
    else {
      const first = text.charCodeAt(position);
      if (!(first >= 0x31 && first <= 0x39)) fail('SYNTAX');
      do { position++; } while (digit());
    }
    if (text[position] === '.') {
      position++;
      if (!digit()) fail('SYNTAX');
      do { position++; } while (digit());
    }
    if (text[position] === 'e' || text[position] === 'E') {
      position++;
      if (text[position] === '+' || text[position] === '-') position++;
      if (!digit()) fail('SYNTAX');
      do { position++; } while (digit());
    }
  }

  function value(depth) {
    whitespace();
    item();
    const first = text[position];
    if (first === '{' || first === '[') {
      if (depth >= BOUNDED_JSON_LIMITS.maxDepth) fail('LIMIT');
      position++;
      whitespace();
      if (first === '{') {
        const names = new Set();
        if (text[position] === '}') { position++; return; }
        for (;;) {
          item();
          const name = string();
          if (names.has(name)) fail('DUPLICATE_KEY');
          names.add(name);
          whitespace();
          if (text[position++] !== ':') fail('SYNTAX');
          value(depth + 1);
          whitespace();
          const next = text[position++];
          if (next === '}') return;
          if (next !== ',') fail('SYNTAX');
          whitespace();
        }
      } else {
        if (text[position] === ']') { position++; return; }
        for (;;) {
          value(depth + 1);
          whitespace();
          const next = text[position++];
          if (next === ']') return;
          if (next !== ',') fail('SYNTAX');
        }
      }
    }
    if (first === '"') { string(); return; }
    if (first === '-' || digit()) { number(); return; }
    for (const literal of ['true', 'false', 'null']) {
      if (text.startsWith(literal, position)) { position += literal.length; return; }
    }
    fail('SYNTAX');
  }

  value(0);
  whitespace();
  if (position !== text.length) fail('SYNTAX');
  try { return JSON.parse(text); }
  catch { fail('SYNTAX'); }
}

/** Read a native response stream with bounded byte retention. This assumes the
 * native Response/reader surface, not hostile Proxy or modified built-ins.
 * Cancellation and lock release are attempted even when reading fails; cleanup
 * never replaces the original read, size, UTF-8 or JSON error.
 */
export async function readBoundedJson(response, maxBytes = BOUNDED_JSON_LIMITS.maxBytes) {
  byteLimit(maxBytes);
  if (!response || typeof response !== 'object' || response.ok !== true || !response.body) {
    try { await response?.body?.cancel(); } catch { /* Preserve the response error. */ }
    const error = new Error('JSON response is unavailable.');
    error.code = 'BOUNDED_JSON_TYPE';
    throw error;
  }
  const bytes = new Uint8Array(maxBytes);
  const reader = response.body.getReader();
  let length = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) fail('TYPE');
      if (value.byteLength > maxBytes - length) fail('LIMIT');
      // Capture bytes before the next await without retaining per-chunk
      // objects. Arbitrary chunk splits share this one bounded buffer.
      bytes.set(value, length);
      length += value.byteLength;
    }
  } finally {
    try { await reader.cancel(); } catch { /* Preserve the primary result. */ }
    try { reader.releaseLock(); } catch { /* Preserve the primary result. */ }
  }
  let text;
  try {
    // Retain a leading BOM as U+FEFF so JSON grammar rejects it explicitly.
    text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes.subarray(0, length));
  } catch { fail('SYNTAX'); }
  return parseBoundedJson(text, maxBytes);
}
