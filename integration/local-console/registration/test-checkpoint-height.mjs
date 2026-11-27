import http from 'node:http';
import {once} from 'node:events';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {serveCheckpointPortal} from './checkpoint-portal.mjs';
import {capturePostCapsule} from './post-capsule.mjs';

export async function testCheckpointHeight({rpc,post,token,pool,fee,name,mine}){
  const snapshot=await rpc('evm_snapshot',[]);
  try{
    const advance=async()=>{
      const block=await rpc("eth_getBlockByNumber",["latest",false]);
      await rpc("evm_setNextBlockTimestamp",[Number(BigInt(block.timestamp))+1]);
    };
    await advance();
    await mine(token.approve(pool.target,fee));
    await advance();
    const second=await mine(pool.publish(name,'checkpoint batch control'));
    await advance();
    await rpc('evm_mine',[]);
    const head=await rpc('eth_getBlockByNumber',['latest',false]);
    const pairs=[];
    for(const receipt of [post,second]){
      const archive=await capturePostCapsule(rpc,receipt.blockHash,receipt.hash);
      pairs.push([archive,{originalBlockHash:receipt.blockHash,transactionHash:receipt.hash}]);
    }
    for(const count of [1,2]){
      let requests=0, expectedReads=0;
      const server=http.createServer((req,res)=>{
        const verification=req.url==='/checkpoint/verify';
        if(verification)requests++;
        let reads=0;
        const observed=async(method,args)=>{
          const value=await rpc(method,args);
          if(verification && method==='eth_getBlockByNumber' && args[0]===head.number){
            reads++;
            if(requests===1)expectedReads=reads;
            if(requests===2 && reads===expectedReads)return {...value,number:'0x0'};
          }
          return value;
        };
        return serveCheckpointPortal(req,res,observed,'127.0.0.1:'+server.address().port);
      });
      server.listen(0,'127.0.0.1');await once(server,'listening');
      try{
        const child=spawn('python3',[fileURLToPath(new URL('./test-checkpoint-height.py',import.meta.url))],{stdio:['pipe','inherit','inherit']});
        child.stdin.end(JSON.stringify({url:'http://127.0.0.1:'+server.address().port+'/checkpoint',head,count,files:pairs.slice(0,count).flat()}));
        const [code]=await once(child,'exit');if(code!==0)throw Error('Checkpoint height browser regression.');
      }finally{server.close();}
    }
  }finally{await rpc('evm_revert',[snapshot]);}
}
