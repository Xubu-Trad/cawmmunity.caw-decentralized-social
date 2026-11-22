import {submitPaidPost, readPaidDelivery, checkPaidDelivery, deliveryStorageKey} from './paid-post-delivery.mjs';
import {signReviewedPaidPost} from './paid-post-signing.mjs';

const el = id => document.getElementById('paid-' + id);
let enabled = false;
let busy = false;
let generation = 0;
let review = null;
let authorized = null;
let pendingDelivery = false;
let provider = null;
let account = null;

function status(message, tone = '') {
  el('status').dataset.tone = tone;
  el('status').textContent = message;
}

function controls() {
  el('inputs').disabled = !enabled || busy;
  el('retry').hidden = enabled || busy;
  el('connect').disabled = !enabled || busy;
  el('delivery').hidden = !authorized;
  el('submit').disabled = !authorized || !enabled || busy || pendingDelivery || provider !== window.ethereum;
  el('check-receipt').disabled = !enabled || busy;
  el('connect').textContent = account ? 'Reconnect wallet' : 'Connect disposable wallet';
  el('sign').disabled = !enabled || busy || !review || provider !== window.ethereum ||
    !account || review.controller.toLowerCase() !== account.toLowerCase();
}

function clearReview(message) {
  generation++;
  review = null;
  authorized = null;
  el('review').hidden = true;
  el('result').hidden = true;
  el('result').replaceChildren();
  if (message) status(message);
  controls();
}

const intent = () => ({text: el('text').value, validAfter: el('start').value, deadline: el('end').value});
const sameIntent = (a, b) => a?.text === b.text && a.validAfter === b.validAfter && a.deadline === b.deadline;

async function api(path, body) {
  const options = {cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(20000)};
  if (body !== undefined) {
    options.method = 'POST';
    options.headers = {'Content-Type': 'application/json'};
    options.body = JSON.stringify(body);
  }
  const response = await fetch('/api/paid-post/' + path, options);
  const data = await response.json();
  if (!response.ok) throw Error(data?.error || 'Local fixture request failed.');
  return data;
}

async function checkFixture() {
  if (busy) return;
  busy = true;
  clearReview('Checking the local paid-post fixture…');
  try {
    enabled = (await api('config')).enabled === true;
    status(enabled ? 'Fixture configured. Enter your post and review the fee.' :
      'Paid-post fixture disabled. Configure the local C-007 endpoint to enable review.');
  } catch {
    enabled = false;
    status('Fixture configuration unavailable. Check the local console connection.', 'error');
  } finally { busy = false; controls(); }
}

function showRows(id, values) {
  const rows = values.map(([name, value]) => {
    const row = document.createElement('div');
    const label = document.createElement('dt');
    const data = document.createElement('dd');
    label.textContent = name;
    data.textContent = value;
    row.append(label, data);
    return row;
  });
  el(id).replaceChildren(...rows);
}

// The reviewed fixture token has 18 decimals. Display every significant digit.
function mockTokens(raw) {
  if (typeof raw !== 'string' || !/^(?:0|[1-9][0-9]{0,77})$/.test(raw)) throw Error('Invalid mock-token amount.');
  const padded = raw.padStart(19, '0');
  const fraction = padded.slice(-18).replace(/0+$/, '');
  return padded.slice(0, -18) + (fraction ? '.' + fraction : '') + ' mock';
}

// Escape nonprinting format characters as well as normal JSON control escapes.
function exactText(text) {
  return JSON.stringify(text).replace(/[\p{Cf}\p{Zl}\p{Zp}]/gu,
    char => '\\u{' + char.codePointAt(0).toString(16) + '}');
}

function showReview(value) {
  const {preview, settlement, block} = value;
  const {message, domain} = preview.typedData;
  if (!sameIntent(value.intent, intent()) || preview.text !== value.intent.text ||
      typeof value.controller !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(value.controller)) {
    throw Error('The returned review does not match this intent.');
  }
  showRows('summary', [
    ['Exact post', exactText(preview.text)], ['Protocol fee', mockTokens(message.fee)],
    ['Account 2 share', mockTokens(settlement.share2)], ['Account 3 share', mockTokens(settlement.share3)],
    ['Rounding remainder', mockTokens(settlement.dust)], ['Signing controller', value.controller]
  ]);
  showRows('fields', [
    ['Account', message.accountId], ['Owner wallet', value.owner], ['Ownership epoch', message.epoch],
    ['Nonce', message.nonce], ['Valid from / expires', message.validAfter + ' / ' + message.deadline],
    ['Chain ID', String(BigInt(domain.chainId))], ['Verifying contract', domain.verifyingContract],
    ['Review block', String(BigInt(block.number))], ['Block hash', block.hash], ['Stake root', message.stakeRoot],
    ['Post hash', message.textHash], ['Signing digest', preview.digest]
  ]);
  el('review').hidden = false;
}

function forgetWallet() {
  for (const event of ['accountsChanged','chainChanged','disconnect']) provider?.removeListener?.(event, walletChanged);
  provider = null;
  account = null;
  el('wallet').textContent = 'No signing wallet connected.';
}

function walletChanged() {
  forgetWallet();
  clearReview('Wallet context changed. Reconnect and review the post again.');
}

async function connect() {
  if (busy || !enabled) return;
  busy = true;
  controls();
  const candidate = window.ethereum;
  if (provider) walletChanged();
  const start = generation;
  try {
    if (!candidate?.request) throw Error('Open this console with a disposable browser wallet.');
    status('Waiting for wallet connection…', 'busy');
    await candidate.request({method: 'eth_requestAccounts'});
    provider = candidate;
    for (const event of ['accountsChanged','chainChanged','disconnect']) candidate.on?.(event, walletChanged);
    const accounts = await candidate.request({method: 'eth_accounts'});
    if (generation !== start || window.ethereum !== candidate) throw Error('Wallet changed. Connect again.');
    if (!Array.isArray(accounts) || !/^0x[0-9a-fA-F]{40}$/.test(accounts[0])) throw Error('No valid wallet account selected.');
    account = accounts[0];
    el('wallet').textContent = 'Connected · ' + account;
    status(review ? signingHint() : 'Wallet connected. Review the post before signing.', 'ready');
  } catch (error) {
    forgetWallet();
    status(error.message || 'Wallet connection declined.', 'error');
  } finally { busy = false; controls(); }
}

function signingHint() {
  if (!account) return 'State reviewed. Connect the displayed controller to sign.';
  if (account.toLowerCase() !== review.controller.toLowerCase()) return 'State reviewed. Select the displayed signing controller in your wallet.';
  return 'State reviewed. Recheck and sign when the text and fee match your intent.';
}

el('form').addEventListener('input', () => clearReview('Intent edited. Review the current text and validity window.'));
el('form').addEventListener('submit', async event => {
  event.preventDefault();
  if (busy || !enabled) return;
  busy = true;
  clearReview('Checking local state and settlement…');
  const start = generation;
  const requested = intent();
  try {
    const value = await api('prepare', requested);
    if (generation !== start || !sameIntent(requested, intent())) return;
    showReview(value);
    review = value;
    status(signingHint(), 'ready');
  } catch (error) {
    if (generation === start) { clearReview(); status(error.message, 'error'); }
  } finally { busy = false; controls(); }
});

el('sign').addEventListener('click', async () => {
  if (el('sign').disabled || busy) return;
  busy = true;
  controls();
  const selected = review;
  const start = generation;
  const wallet = provider;
  const isCurrent = () => start === generation && selected === review && wallet === window.ethereum && sameIntent(selected.intent, intent());
  try {
    let signedRequest;
    const result = await signReviewedPaidPost({provider: wallet, review: selected, isCurrent,
      recheck: saved => api('recheck', saved), verifySignature: async signed => {
        const response = await api('verify', signed);
        signedRequest = signed;
        return response;
      },
      onPhase(phase) {
        if (!isCurrent()) return;
        const messages = {rechecking: 'Rechecking local proofs…', 'awaiting-wallet': 'Approve or decline in your wallet.', verifying: 'Checking the returned signature…'};
        status(messages[phase], 'busy');
      }
    });
    if (!isCurrent()) throw Error('Review changed. Prepare a fresh intent.');
    authorized = signedRequest;
    review = null;
    showRows('result', [['Verified signer', result.signer], ['Verified digest', result.digest], ['Verified block', result.block.hash]]);
    el('result').hidden = false;
    status('Controller signature verified. Choose Publish paid post to request a transaction.', 'ready');
  } catch (error) {
    clearReview();
    status(error.message || 'Signing stopped. Review the intent again.', 'error');
  } finally { busy = false; controls(); }
});

el('retry').addEventListener('click', checkFixture);
el('connect').addEventListener('click', connect);
function checkOnEntry() {
  if (window.location.hash === '#paid-post' && !enabled && !busy) checkFixture();
}
window.addEventListener('hashchange', checkOnEntry);
checkOnEntry();

const deliveryContext = () => ({storage: window.localStorage, locks: navigator.locks});

function showSavedDelivery() {
  try {
    const record = readPaidDelivery(window.localStorage);
    pendingDelivery = record?.status === 'pending';
    el('recovery').hidden = !record;
    if (!record) return;
    el('recovery-hash').value = record.hash || '';
    el('recovery-hash').readOnly = Boolean(record.hash);
    el('saved-digest').textContent = record.review.preview.digest;
    el('saved-post').textContent = exactText(record.review.intent.text);
    el('submission-status').textContent = pendingDelivery
      ? (record.hash ? 'Wallet returned a transaction hash. Check its settlement.' : 'Wallet outcome unknown. Find the hash in wallet activity and check it here.')
      : 'Last checked outcome: ' + record.status + '. You can recheck the stored transaction.';
  } catch {
    pendingDelivery = true;
    el('submission-status').textContent = 'Saved submission cannot be read. Restore the recovery record before submitting.';
    el('recovery').hidden = true;
  }
}

el('submit').addEventListener('click',async () => {
  if (busy || !authorized || el('submit').disabled) return;
  el('settlement').hidden = true;
  const signed = authorized;
  const wallet = provider;
  const start = generation;
  const isCurrent = () => generation === start && signed === authorized && wallet === window.ethereum &&
    sameIntent(signed.review.intent,intent());
  busy = true;
  controls();
  try {
    status('Rechecking authorization and opening a separate transaction approval…', 'busy');
    await submitPaidPost({provider:wallet, authorization:signed, isCurrent, context:deliveryContext(),
      recheck:saved => api('recheck',saved), verifySignature:request => api('verify',request)});
    status('Transaction submitted. Check its receipt to verify settlement.', 'ready');
  } catch (error) {
    status(error.message || 'Submission interrupted. Check the saved delivery.', 'error');
  } finally {
    authorized = null;
    busy = false;
    showSavedDelivery();
    controls();
  }
});

el('check-receipt').addEventListener('click',async () => {
  if (busy || !enabled) return;
  busy = true;
  controls();
  el('settlement').hidden = true;
  try {
    const hash = el('recovery-hash').value.trim();
    const result = await checkPaidDelivery(deliveryContext(),hash,body => api('receipt',body));
    showSavedDelivery();
    if (result.status === 'pending') {
      el('submission-status').textContent = 'No verified receipt yet. You can check again.';
    } else if (result.status === 'reverted') {
      el('submission-status').textContent = 'Verified transaction reverted.';
    } else {
      el('submission-status').textContent = 'Paid post settled. Receipt and balances verified.';
      showRows('settlement', [['Verified post',exactText(result.text)],['Transaction',result.hash],
        ['Settlement block',result.block.hash],['Payer fee',mockTokens(result.settlement.fee)],
        ['Account 2 received',mockTokens(result.settlement.share2)],
        ['Account 3 received',mockTokens(result.settlement.share3)],['Rounding remainder',mockTokens(result.settlement.dust)]]);
      el('settlement').hidden = false;
    }
  } catch (error) {
    el('submission-status').textContent = 'Settlement unverified. ' + error.message;
  } finally {
    busy = false;
    controls();
  }
});

window.addEventListener('storage', event => {
  if (event.key !== null && event.key !== deliveryStorageKey) return;
  el('settlement').hidden = true;
  showSavedDelivery();
  controls();
});
showSavedDelivery();
controls();
