import {exactText, mockTokens} from './paid-post-format.mjs';

const element = id => document.getElementById('reader-' + id);
const field = element('hash');
const result = element('result');
const hashPattern = /^0x[0-9a-f]{64}$/;
let active;

function clear(status) {
  active?.abort();
  active = undefined;
  result.hidden = true;
  element('text').textContent = '';
  element('facts').replaceChildren();
  element('proof').replaceChildren();
  element('status').textContent = status;
}

function rows(id, entries) {
  const elements = entries.map(([name, value]) => {
    const row = document.createElement('div');
    const label = document.createElement('dt');
    const content = document.createElement('dd');
    label.textContent = name;
    content.textContent = value;
    row.append(label, content);
    return row;
  });
  element(id).replaceChildren(...elements);
}

function display(post) {
  if (post.source !== 'node' && post.source !== 'recorded') throw Error('Unknown evidence source.');
  if (post.status !== 'settled' || typeof post.text !== 'string' || !post.text.length ||
      [...post.text].length > 420 || !/^0x[0-9a-f]{40}$/.test(post.signer) ||
      (post.submitter !== undefined && !/^0x[0-9a-f]{40}$/.test(post.submitter)) ||
      !hashPattern.test(post.block?.hash) || !/^0x(0|[1-9a-f][0-9a-f]{0,15})$/.test(post.block.number) ||
      !hashPattern.test(post.digest) || !hashPattern.test(post.calldataHash)) {
    throw Error('Incomplete verification result.');
  }
  const {fee, share2, share3, dust} = post.settlement || {};
  const shares = [
    ['Account 2 credit', mockTokens(share2)], ['Account 3 credit', mockTokens(share3)],
    ['Rounding remainder', mockTokens(dust)]
  ];
  if (fee !== String(5000n * 10n ** 18n) || BigInt(share2) + BigInt(share3) + BigInt(dust) !== BigInt(fee)) {
    throw Error('The credits and rounding remainder must account for the fixed post fee.');
  }
  const facts = [['Post authorization signer', post.signer]];
  if (post.submitter !== undefined) facts.push(['Transaction submitter', post.submitter]);
  facts.push(['Block', BigInt(post.block.number).toString()], ['Post fee', mockTokens(fee)]);
  rows('facts', facts);
  rows('proof', [['Transaction hash', post.hash], ['Block hash', post.block.hash],
    ['Signed message digest', post.digest], ['Calldata hash', post.calldataHash],
    ...shares, ['Exact text', exactText(post.text)]]);
  element('text').textContent = post.text;
  element('scope').textContent = post.source === 'recorded'
    ? 'The verifier replayed the recorded block, receipt and state proofs. The result describes that recording. The fee is in mock tokens.'
    : 'The verifier checked the signed transaction, receipt and settlement against the selected research node’s block and state proofs. The node supplies the chain history. The fee is in mock tokens.';
  result.hidden = false;
}

async function lookup() {
  clear('Looking up the transaction and checking settlement…');
  const hash = field.value.trim().toLowerCase();
  if (!hashPattern.test(hash)) {
    clear('Enter a transaction hash beginning with 0x followed by 64 hexadecimal digits.');
    history.replaceState(null, '', location.pathname);
    return;
  }
  field.value = hash;
  history.replaceState(null, '', '#' + hash);
  const job = new AbortController();
  active = job;
  const timeout = setTimeout(() => job.abort(), 30000);
  try {
    const response = await fetch('/api/paid-post/read', {
      method: 'POST', mode: 'same-origin', credentials: 'omit', redirect: 'error',
      cache: 'no-store', headers: {'Content-Type': 'application/json'},
      signal: job.signal, body: JSON.stringify({hash})
    });
    const post = await response.json();
    if (active !== job) return;
    if (!response.ok) throw Error(typeof post?.error === 'string' ? post.error : 'Node request failed.');
    if (post?.hash !== hash) throw Error('The verifier returned a different transaction.');
    if (post.status === 'pending') {
      element('status').textContent = post.source === 'recorded' ? 'This recording contains no receipt for that hash.'
        : 'No receipt in the selected history yet. Check the network and try again.';
    } else if (post.status === 'reverted') {
      element('status').textContent = post.source === 'recorded' ? 'The recorded transaction reverted. No post was published.'
        : 'The transaction reverted. No post was published.';
    } else {
      display(post);
      element('status').textContent = post.source === 'recorded' ? 'Post and settlement verified from recorded evidence.'
        : 'Post and settlement verified on the research node.';
    }
  } catch (error) {
    if (active === job) {
      clear(job.signal.aborted ? 'Verification timed out. Try again.' : 'Post unverified. ' + error.message);
    }
  } finally {
    clearTimeout(timeout);
    if (active === job) active = undefined;
  }
}

field.addEventListener('input', () => {
  clear('Ready to verify the transaction hash.');
  history.replaceState(null, '', location.pathname);
});
element('form').addEventListener('submit', event => {
  event.preventDefault();
  lookup();
});
function openFragment() {
  field.value = location.hash.slice(1);
  if (field.value) lookup();
  else clear('Enter the hash from the publishing transaction.');
}
window.addEventListener('hashchange', openFragment);
openFragment();
