import {parseBoundedJson} from '../../public/bounded-json.mjs';

export async function readJsonBody(stream, limit, limitError) {
  const chunks = [];
  let size = 0;
  for await (const chunk of stream) {
    size += chunk.length;
    if (size > limit) throw Error(limitError);
    chunks.push(chunk);
  }
  const text = new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(Buffer.concat(chunks, size));
  return parseBoundedJson(text, limit);
}

export function createLocalRpc(endpointText, {limit = 131072, timeout = 3000} = {}) {
  const endpoint = new URL(endpointText);
  if (endpoint.protocol !== 'http:' || endpoint.hostname !== '127.0.0.1' ||
      endpoint.username || endpoint.password || endpoint.search || endpoint.hash) throw Error('LOCAL_RPC_REQUIRED');
  let sequence = 0;
  return async (method, params, signal) => {
    const id = ++sequence;
    const deadline = AbortSignal.timeout(timeout);
    const response = await fetch(endpoint, {method:'POST', redirect:'error',
      headers:{'Content-Type':'application/json'}, body:JSON.stringify({jsonrpc:'2.0',id,method,params}),
      signal:signal ? AbortSignal.any([signal,deadline]) : deadline});
    if (!response.ok) throw Error('RPC_HTTP');
    const value = await readJsonBody(response.body,limit,'RPC_LIMIT');
    if (value?.jsonrpc !== '2.0' || value.id !== id || Object.hasOwn(value,'error') ||
        !Object.hasOwn(value,'result')) throw Error('RPC_RESPONSE');
    return value.result;
  };
}
