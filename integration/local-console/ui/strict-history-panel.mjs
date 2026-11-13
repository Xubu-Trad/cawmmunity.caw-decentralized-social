// This view displays only the strict server endpoint; it never falls back to logs.
export function mountStrictHistory(document, fetcher = fetch) {
  const button = document.getElementById('verify-history');
  const status = document.getElementById('verified-history-status');
  const list = document.getElementById('verified-posts');
  let generation = 0;
  function clear() {
    generation++;
    list.replaceChildren();
    status.textContent = 'Not checked. Verify the selected local history explicitly.';
    button.disabled = false;
  }
  async function verify() {
    const token = ++generation;
    list.replaceChildren();
    button.disabled = true;
    status.textContent = 'Checking signed blocks, receipts and ownership proofs…';
    try {
      const response = await fetcher('/api/verified-posts', {cache: 'no-store', signal: AbortSignal.timeout(35000)});
      const text = await response.text();
      if (text.length > 262144) throw Error('Response exceeds the local history limit.');
      const value = JSON.parse(text);
      if (!response.ok) throw Error(value.error || 'Verification rejected.');
      if (value.status !== 'VERIFIED_LOCAL_HISTORY' || value.verificationLocation !== 'local-console-server' ||
          value.publicChainAuthenticated !== false || value.consensusVerified !== false ||
          value.transactionAndReceiptCommitmentsVerified !== true || value.signaturesVerified !== true ||
          value.parentOwnershipProofsVerified !== true || value.postNonceComplete !== true ||
          !/^0x[0-9a-f]{64}$/.test(value.blockHash) || !/^0x[0-9a-f]+$/.test(value.blockNumber) ||
          !Array.isArray(value.posts) || value.posts.length > 128) throw Error('Strict acceptance record is missing or invalid.');
      const rows = value.posts.map((post, index) => {
        if (post.nonce !== String(index) || typeof post.text !== 'string' || !/^0x[0-9a-f]{40}$/.test(post.author)) throw Error('Invalid verified post.');
        const row = document.createElement('article');row.className = 'post';
        const metadata = document.createElement('p');metadata.className = 'subtle';
        metadata.textContent = 'Account 2 · epoch ' + post.epoch + ' · post ' + post.nonce + ' · ' + post.author;
        const body = document.createElement('p');body.className = 'post-text';body.textContent = post.text;
        row.append(metadata, body);return row;
      });
      if (generation !== token) return;
      list.append(...rows);
      status.textContent = 'Verified locally: ' + rows.length + ' posts through block ' + value.blockNumber + ' (' + value.blockHash + '). Checked by this console server; not public-chain finality.';
    } catch (error) {
      if (generation !== token) return;
      list.replaceChildren();status.textContent = 'Not accepted: ' + error.message + ' No verified or empty history is established.';
    } finally { if (generation === token) button.disabled = false; }
  }
  button.addEventListener('click', verify);
  document.getElementById('refresh').addEventListener('click', clear);
  document.getElementById('confirm').addEventListener('click', clear);
  return {verify, clear};
}
if (typeof document !== 'undefined') mountStrictHistory(document);
