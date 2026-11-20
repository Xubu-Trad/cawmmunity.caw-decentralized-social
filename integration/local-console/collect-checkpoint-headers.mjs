import { inspectExecutionHeader, inspectExecutionHeaderChain } from '../../reference/ethereum-execution-header.mjs';
import { BOUNDED_JSON_LIMITS, parseBoundedJson } from '../../public/bounded-json.mjs';

// Follow a separately selected checkpoint by hash. Never ask the provider to
// select the checkpoint, and emit the file only after the entire interval passes.
async function collect(endpoint, startHash, endHash) {
  const url = new URL(endpoint);
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.username ||
      url.password || url.search || url.hash) throw Error('Expected a local IPv4 HTTP endpoint.');
  if (![startHash, endHash].every(hash => /^0x[0-9a-f]{64}$/.test(hash)) ||
      startHash === endHash) throw Error('Supply two distinct block hashes.');
  const deadline = AbortSignal.timeout(30000);
  const headers = [];
  let hash = endHash;
  while (headers.length < 129) {
    const id = headers.length + 1;
    const response = await fetch(url, { method: 'POST', redirect: 'error',
      signal: AbortSignal.any([deadline, AbortSignal.timeout(3000)]),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id, method: 'eth_getBlockByHash', params: [hash, false] }) });
    if (!response.ok) throw Error('Block request failed.');
    const chunks = [];
    let bytes = 0;
    for await (const chunk of response.body) {
      bytes += chunk.length;
      if (bytes > 131072) throw Error('Block response too large.');
      chunks.push(chunk);
    }
    const message = parseBoundedJson(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)), 131072);
    if (message.jsonrpc !== '2.0' || message.id !== id || Object.hasOwn(message, 'error') ||
        !message.result) throw Error('Requested block unavailable.');
    const header = message.result;
    // These RPC fields describe bodies or auxiliary node metadata; the
    // consensus fields committing to the body and receipts stay in the file.
    for (const field of ['transactions','uncles','withdrawals','size','totalDifficulty']) delete header[field];
    const checked = inspectExecutionHeader(header, { schema: 'caw-execution-header-selection/1',
      profile: 'shanghai-17', hash });
    headers.push(header);
    if (hash === startHash) {
      headers.reverse();
      inspectExecutionHeaderChain(headers, { schema: 'caw-execution-header-chain-selection/1',
        profile: 'shanghai-17', startHash, endHash });
      const output = JSON.stringify(headers) + '\n';
      if (Buffer.byteLength(output) > BOUNDED_JSON_LIMITS.maxBytes) throw Error('Header file too large.');
      return output;
    }
    if (checked.number === '0x0') break;
    hash = checked.parentHash;
  }
  throw Error('Start block was not reached within the supported history.');
}

try {
  if (process.argv.length !== 5) throw Error('Usage: node collect-checkpoint-headers.mjs RPC_URL START_HASH CHECKPOINT_HASH');
  process.stdout.write(await collect(...process.argv.slice(2)));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
