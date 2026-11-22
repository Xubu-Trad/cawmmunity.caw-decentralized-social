import {recommendedUsernameBurn} from './economics.mjs';
const nameField = document.getElementById('portal-name');
nameField?.addEventListener('input', () => {
  const amount = recommendedUsernameBurn(nameField.value);
  document.getElementById('portal-quote').textContent = !nameField.value ? 'Enter a username.' :
    amount === null ? 'Use only a–z and 0–9.' : (amount / 10n**18n).toLocaleString('en-US') + ' CAW proposed burn';
});

// Read one snapshot of the operator-selected disposable registry.
const lookup = document.getElementById('local-name-lookup');
if (lookup && ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) {
  lookup.hidden = false;
  const registry = lookup.querySelector('input');
  const result = lookup.querySelector('output');
  const provider = window.ethereum;
  let revision = 0;
  function invalidate() {
    revision++;
    result.textContent = '';
  }
  nameField.addEventListener('input', invalidate);
  registry.addEventListener('input', invalidate);
  provider?.on?.('chainChanged', invalidate);
  lookup.querySelector('button').addEventListener('click', async () => {
    const run = ++revision;
    const name = nameField.value;
    const to = registry.value.trim();
    try {
      const expected = recommendedUsernameBurn(name);
      if (expected === null || !name) throw Error('Enter a valid username first.');
      if (!/^0x[0-9a-fA-F]{40}$/.test(to)) throw Error('Enter the local candidate contract address.');
      if (!provider?.request) throw Error('Open a browser with a wallet connected to the disposable chain.');
      const request = (method, params = []) => provider.request({method, params});
      result.textContent = 'Reading local registry…';
      if (await request('eth_chainId') !== '0x539') throw Error('Select the disposable chain (1337).');
      const head = await request('eth_getBlockByNumber', ['latest', false]);
      if (!/^0x[0-9a-f]{64}$/i.test(head?.hash) || !/^0x[0-9a-f]+$/i.test(head.number)) throw Error('Invalid block.');
      // lookup(string) returns the raw CAW price and the current ERC-721 owner.
      const word = n => n.toString(16).padStart(64, '0');
      const text = Array.from(new TextEncoder().encode(name), b => b.toString(16).padStart(2, '0')).join('');
      const data = '0xf67187ac' + word(32) + word(name.length) + text.padEnd(Math.ceil(name.length / 32) * 64, '0');
      const response = await request('eth_call', [{to, data}, {blockHash: head.hash, requireCanonical: true}]);
      if (!/^0x[0-9a-f]{64}0{24}[0-9a-f]{40}$/i.test(response) ||
          BigInt(response.slice(0, 66)) !== expected) throw Error('Registry response does not match the candidate terms.');
      if (await request('eth_chainId') !== '0x539') throw Error('Chain changed during lookup.');
      const owner = '0x' + response.slice(-40);
      const state = BigInt(owner) === 0n ? 'Available' : 'Registered to ' + owner;
      if (revision === run) result.textContent = state + ' at local block ' + BigInt(head.number) + ' in ' + to + '.';
    } catch (error) {
      if (revision === run) result.textContent = 'Lookup unavailable. ' + (error.message || 'Check the selected registry and wallet.');
    }
  });
}

import { loadEnvironment } from './deployment.mjs';
const status = document.getElementById('alpha-environment');
const entries = document.querySelectorAll('[data-alpha-entry]');
try {
  await loadEnvironment();
  status.textContent = 'Alpha simulation. No connected wallet, chain or upload service.';
  for (const entry of entries) entry.removeAttribute('aria-disabled');
} catch {
  status.textContent = 'Alpha configuration could not be verified. App entry is disabled; source review remains available.';
  for (const entry of entries) { entry.removeAttribute('href'); entry.setAttribute('aria-disabled', 'true'); }
}
