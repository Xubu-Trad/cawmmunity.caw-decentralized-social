import {recoverWalletFromChunks} from './wallet-recovery-store.mjs';
// Research transport: explicit loopback source, no redirect or automatic discovery.
export async function recoverWalletOverLoopback(url,selection,directory,checkpoint,timeoutMs=10000){
 const u=new URL(url);if(u.protocol!=='http:'||u.hostname!=='127.0.0.1'||u.username||u.password)throw Error('SOURCE_NOT_LOOPBACK');
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000)throw Error('TIMEOUT_LIMIT');
 const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),timeoutMs);
 try{const response=await fetch(u,{signal:abort.signal,redirect:'error'});if(response.status!==200||!response.body)throw Error('HTTP_RESPONSE');return await recoverWalletFromChunks(response.body,selection,directory,checkpoint);}
 finally{clearTimeout(timer);abort.abort();}
}
