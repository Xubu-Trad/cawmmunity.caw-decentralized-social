import {createLocalRpc} from './local-rpc.mjs';
import {readJsonFile} from './read-proof-file.mjs';
import {preparePaidPost,recheckPaidPost} from './paid-post-state.mjs';

const [mode, endpointText, inputPath] = process.argv.slice(2);
if (process.argv.length !== 5 || !['prepare','recheck'].includes(mode)) {
  throw Error('Usage: node paid-post-live.mjs prepare|recheck http://127.0.0.1:PORT input.json');
}
const rpc = createLocalRpc(endpointText, {limit:262144,timeout:5000});
const input = readJsonFile(inputPath, 32768);
try {
  const result = mode === 'prepare' ? await preparePaidPost(rpc,input) : await recheckPaidPost(rpc,input);
  console.log(JSON.stringify(result,null,2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
