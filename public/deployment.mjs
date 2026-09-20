// This alpha supports synthetic operation only. Real transport requires reviewed code.
import {readBoundedJson} from './bounded-json.mjs';
const FIELDS = ['schema', 'release', 'mode', 'chainId', 'contracts', 'rpcUrls', 'walletEnabled', 'mediaUploadEnabled', 'scenario'];
export function validateEnvironment(value) {
  const fail = () => { throw new Error('This alpha supports simulation only. No wallet or chain connection was started.'); };
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail();
  if (Object.keys(value).length !== FIELDS.length || !FIELDS.every(key => Object.hasOwn(value, key))) fail();
  if (value.schema !== 'caw-alpha-environment/1' || value.release !== '0.1.0-alpha.20' ||
      value.mode !== 'simulation' || value.chainId !== null || value.walletEnabled !== false ||
      value.mediaUploadEnabled !== false || value.scenario !== 'recommended-appendix-provisional') fail();
  if (!value.contracts || typeof value.contracts !== 'object' || Array.isArray(value.contracts) || Object.keys(value.contracts).length) fail();
  if (!Array.isArray(value.rpcUrls) || value.rpcUrls.length) fail();
  return Object.freeze({ ...value, contracts: Object.freeze({}), rpcUrls: Object.freeze([]) });
}

export async function loadEnvironment(fetcher = fetch) {
  const response = await fetcher(new URL('./deployment.json', import.meta.url), {
    credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(5000)
  });
  return validateEnvironment(await readBoundedJson(response,4096));
}

// Only the bundled synthetic seed is fetched. The model still validates its schema.
export async function loadFixtures(fetcher = fetch) {
  const response = await fetcher(new URL('./fixtures.json', import.meta.url), {
    credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(5000)
  });
  return readBoundedJson(response,65536);
}
