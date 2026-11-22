import {recommendedUsernameBurn} from './economics.mjs';
const nameField = document.getElementById('portal-name');
nameField?.addEventListener('input', () => {
  const amount = recommendedUsernameBurn(nameField.value);
  document.getElementById('portal-quote').textContent = !nameField.value ? 'Enter a username.' :
    amount === null ? 'Use only a–z and 0–9.' : (amount / 10n**18n).toLocaleString('en-US') + ' CAW proposed burn';
});
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
