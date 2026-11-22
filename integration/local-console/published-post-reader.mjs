import {parseArgs} from 'node:util';
import {createReadStream} from 'node:fs';
import {link, mkdtemp, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createLocalRpc, readJsonBody} from './local-rpc.mjs';
import {readPublishedPost} from './paid-post-settlement.mjs';
import {createPublishedPostServer} from './server.mjs';

const example = new URL('../../evidence/published-post-reader-20261122/proof-reads.json', import.meta.url);
export const exampleHash = '0xd0051e7a446441a8aa7156367b7381b96dfe5ffb11b7ed4307a9b7b38ce1fd6b';
// This selection was published with the mined receipt in PR #30, before this reader.
const exampleBlock = '0x4593ebc25b268c60d078d9d392f745a6ce9d308c41cea77604180722685c3bc0';
const schema = 'caw-published-post-reads/1';

export async function recordedLookup(file = example) {
  const bundle = await readJsonBody(createReadStream(file), 1048576, 'Recorded evidence is too large');
  if (bundle.schema !== schema || bundle.hash !== exampleHash || bundle.blockHash !== exampleBlock ||
      !Array.isArray(bundle.calls) || bundle.calls.length > 64) throw Error('Unexpected example evidence');
  const replies = new Map();
  for (const call of bundle.calls) {
    if (!call || typeof call.method !== 'string' || !Array.isArray(call.params) || !Object.hasOwn(call, 'result')) {
      throw Error('Incomplete recorded call');
    }
    const key = JSON.stringify([call.method,call.params]);
    if (replies.has(key)) throw Error('Duplicate recorded call');
    replies.set(key,call.result);
  }
  return async (hash, signal) => {
    if (typeof hash !== 'string' || hash.toLowerCase() !== exampleHash) {
      throw Error('This recording covers only the example transaction. Use a research node for another hash.');
    }
    const read = (method,params) => {
      signal?.throwIfAborted();
      const key = JSON.stringify([method,params]);
      if (!replies.has(key)) throw Error('Missing recorded evidence for ' + method);
      return replies.get(key);
    };
    const result = await readPublishedPost(read, hash);
    if (result.status !== 'settled' || result.block.hash !== exampleBlock) {
      throw Error('Evidence does not verify against the published example block');
    }
    return {...result, source:'recorded'};
  };
}

function nodeLookup(endpoint, capture) {
  const rpc = createLocalRpc(endpoint, {limit:262144,timeout:5000});
  return async (hash, signal) => {
    const calls = new Map();
    const read = async (method,params) => {
      const result = await rpc(method,params,signal);
      if (capture) {
        const key = JSON.stringify([method,params]);
        if (calls.has(key) && JSON.stringify(calls.get(key).result) !== JSON.stringify(result)) {
          throw Error('The node changed an answer during capture');
        }
        calls.set(key,{method,params,result});
      }
      return result;
    };
    const result = await readPublishedPost(read, hash);
    if (capture) {
      if (result.status !== 'settled') throw Error('Only a settled post can be captured');
      const ordered = [...calls.keys()].sort().map(key => calls.get(key));
      const contents = JSON.stringify({schema,hash:result.hash,blockHash:result.block.hash,calls:ordered}) + '\n';
      if (Buffer.byteLength(contents) > 1048576) throw Error('Recorded evidence is too large');
      // Install a complete capture without replacing an earlier reviewer's file.
      const directory = await mkdtemp(path.join(path.dirname(path.resolve(capture)),'.caw-capture-'));
      try {
        const draft = path.join(directory,'reads.json');
        await writeFile(draft,contents);
        await link(draft,capture);
      } finally {
        await rm(directory,{recursive:true,force:true});
      }
    }
    return {...result,source:'node'};
  };
}

async function main() {
  const {values,positionals} = parseArgs({allowPositionals:true,
    options:{serve:{type:'boolean'},rpc:{type:'string'},capture:{type:'string'}}});
  if ((values.serve ? positionals.length !== 0 : positionals.length !== 1) ||
      (values.capture && (!values.rpc || values.serve))) {
    throw Error('Usage: node published-post-reader.mjs HASH [--rpc URL [--capture NEW_FILE]] | --serve [--rpc URL]');
  }
  const lookup = values.rpc ? nodeLookup(values.rpc,values.capture) : await recordedLookup();
  if (values.serve) {
    const server = createPublishedPostServer(lookup);
    server.listen(0,'127.0.0.1',() => {
      const fragment = values.rpc ? '' : '#' + exampleHash;
      console.log('Post reader: http://127.0.0.1:' + server.address().port + '/published-post.html' + fragment);
      console.log(values.rpc ? 'Verifying against the selected research node.' : 'Verifying the recorded example against its published block hash.');
    });
  } else {
    const result = await lookup(positionals[0]);
    console.log(JSON.stringify(result,null,2));
    if (result.status !== 'settled') process.exitCode = 1;
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
