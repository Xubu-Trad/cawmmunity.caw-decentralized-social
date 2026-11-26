import http from 'node:http';
import {serveCheckpointPortal} from './checkpoint-portal.mjs';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
import {parseEther} from 'ethers';

export async function testFollowingWatch({endpoint,rpc,provider,token,pool,staker,payer,stake,fee,mine,name}){
  const initial=await rpc('evm_snapshot',[]);
  const cwd=fileURLToPath(new URL('.',import.meta.url));
  const portal=http.createServer((req,res)=>serveCheckpointPortal(req,res,rpc,'127.0.0.1:'+portal.address().port));
  portal.listen(0,'127.0.0.1');
  await once(portal,'listening');
  const url='http://127.0.0.1:'+portal.address().port+'/checkpoint/following';
  try{
    await mine(token.connect(staker).approve(pool.target,stake));
    await mine(pool.connect(staker).stake(stake));
    await mine(token.approve(pool.target,fee));
    const second=await provider.getSigner(3);
    const parent=await rpc('evm_snapshot',[]);
    await rpc('evm_mine',[]);await rpc('evm_mine',[]);
    const tx=await pool.publish(name,'automatic feed branch test',{gasLimit:750000});
    const raw=await rpc('eth_getRawTransactionByHash',[tx.hash]);
    const amount=parseEther('300');
    const browser=spawn('python3',['test-following-watch.py'],{cwd,stdio:['pipe','inherit','inherit']});
    browser.stdin.end(JSON.stringify({url,endpoint,parent,hash:tx.hash,raw,second:second.address,token:token.target,pool:pool.target,
      approve:token.interface.encodeFunctionData('approve',[pool.target,amount]),stake:pool.interface.encodeFunctionData('stake',[amount])}));
    const [code]=await once(browser,'exit');if(code!==0)throw Error('Automatic feed browser check failed.');
  }finally{
    portal.close();await rpc('evm_revert',[initial]);
  }
}
