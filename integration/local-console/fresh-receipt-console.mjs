import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {createConsole} from './server.mjs';
const [cfg,out]=process.argv.slice(2),src=path.dirname(fileURLToPath(import.meta.url)),config=JSON.parse(await fs.readFile(cfg)),app=createConsole(config),run=promisify(execFile);
if(!process.env.CHROME_BIN)throw Error('CHROME_BIN_REQUIRED');
await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
try{
 const q=await run(process.execPath,['--experimental-websocket',path.join(src,'test-fresh-receipt-console.mjs'),process.env.CHROME_BIN,'http://127.0.0.1:'+app.server.address().port,config.rpcUrl,out],{timeout:120000,maxBuffer:1024*1024});
 await fs.writeFile(path.join(out,'browser-execution.log'),q.stdout+q.stderr);
 await run(process.execPath,[path.join(src,'capture-posting-history.mjs'),cfg,path.join(out,'evidence')],{timeout:30000});
 const checked=await run(process.execPath,[path.join(src,'check-receipt-history.mjs'),path.join(out,'post-export.json'),path.join(out,'review-state.json'),path.join(out,'evidence/capture.json'),path.join(out,'evidence/selection.json')],{timeout:30000});
 await fs.writeFile(path.join(out,'offline-verification.log'),checked.stdout+checked.stderr);console.log(q.stdout,checked.stdout);
}finally{app.server.closeAllConnections();await new Promise(r=>app.server.close(r));}
