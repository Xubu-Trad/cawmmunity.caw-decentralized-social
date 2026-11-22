import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Wallet, toBeHex} from 'ethers';
import {createConsole} from './server.mjs';

const endpoint = process.argv[2];
const fixture = JSON.parse(await readFile(new URL('../../evidence/console-transfer-receipt-20261115/fixture-context.json', import.meta.url)));
const intent = {text: 'fresh terminal signature review', validAfter: '0', deadline: '1000'};
const config = {...fixture, rpcUrl: endpoint, paidPostRpcUrl: endpoint, postingDeployment: {
  blockNumber:'0x0', blockHash:fixture.genesisHash, transactionHash:fixture.genesisHash
}};
const {server} = createConsole(config);
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const base = 'http://127.0.0.1:' + server.address().port;
async function call(action, input, expected = 200) {
  const response = await fetch(base + '/api/paid-post/' + action, {
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)
  });
  const result = await response.json();
  assert.equal(response.status, expected, result.error);
  return result;
}
try {
  assert.deepEqual(await (await fetch(base+'/api/paid-post/config')).json(),{enabled:true});
  const review = await call('prepare',intent);
  assert.equal(review.block.number,'0x11');
  assert.equal(review.intent.text,intent.text);
  assert.deepEqual(await call('recheck',review),review);
  const {domain,types,message} = review.preview.typedData;
  const postTypes = {Post:types.Post};
  const signer = new Wallet(toBeHex(1,32)); // Public disposable fixture controller at height 17.
  const signature = await signer.signTypedData(domain,postTypes,message);
  assert.deepEqual(await call('verify',{review,signature}),{digest:review.preview.digest,signer:review.controller});
  const wrong = await new Wallet(toBeHex(2,32)).signTypedData(domain,postTypes,message);
  assert.match((await call('verify',{review,signature:wrong},422)).error,/different controller/);
  assert.match((await call('verify',{review,signature:signature.slice(0,-2)+'00'},422)).error,/recovery byte/);
  assert.match((await call('verify',{review:{...review,controller:signer.address},signature},422)).error,/Saved review/);
  console.log('Live HTTP signing review passed at block 17: proof recheck, controller recovery and ERC-1271 acceptance; three invalid inputs rejected.');
} finally {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
