// The reviewed fixture token has 18 decimals. Display every significant digit.
export function mockTokens(raw) {
  if (typeof raw !== 'string' || !/^(?:0|[1-9][0-9]{0,77})$/.test(raw)) throw Error('Invalid mock-token amount.');
  const padded = raw.padStart(19, '0');
  const fraction = padded.slice(-18).replace(/0+$/, '');
  return padded.slice(0, -18) + (fraction ? '.' + fraction : '') + ' mock';
}

// Escape nonprinting format characters as well as normal JSON control escapes.
export function exactText(text) {
  return JSON.stringify(text).replace(/[\p{Cf}\p{Zl}\p{Zp}]/gu,
    char => '\\u{' + char.codePointAt(0).toString(16) + '}');
}
