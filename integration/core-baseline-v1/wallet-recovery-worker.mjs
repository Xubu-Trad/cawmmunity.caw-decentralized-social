import fs from 'node:fs/promises';import {recoverWalletOverLoopback} from './wallet-recovery-transport.mjs';import {readRecoveredWallet} from './wallet-recovery-store.mjs';
const [mode,selectionFile,dir,url,stop]=process.argv.slice(2),selection=await fs.readFile(selectionFile,'utf8');
if(mode==='read'){console.log(JSON.stringify(await readRecoveredWallet(dir,selection)));}
else{const result=await recoverWalletOverLoopback(url,selection,dir,async at=>{if(at===stop){process.send?.({checkpoint:at});await new Promise(()=>{});}},2000);console.log(JSON.stringify(result));}
