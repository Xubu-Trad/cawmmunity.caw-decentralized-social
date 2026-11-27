import http from 'node:http';
import {once} from 'node:events';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {id,toQuantity} from 'ethers';
import {serveCheckpointPortal} from './checkpoint-portal.mjs';

export async function testFollowingHeights(rpc){
  const publication=id('Published(uint256,address,string,string,uint256)');
  for(const scenario of ['selected','final','publication','poll']){
    let feeds=0;
    const server=http.createServer((req,res)=>{
      const feed=req.url==='/checkpoint/following/reader01';
      if(feed)feeds++;
      let latest=0;
      const observed=async(method,args)=>{
        const result=await rpc(method,args);
        if(method==='eth_getBlockByNumber' && args[0]==='latest'){
          latest++;
          if((feed && ((scenario==='selected' && latest===1) || (scenario==='final' && latest===2))) ||
             (scenario==='poll' && (req.url==='/checkpoint/head' || (feed && feeds>1)))){
            return {...result,number:toQuantity(BigInt(result.number)+1n)};
          }
        }
        if(scenario==='publication' && method==='eth_getLogs' && args[0].topics[0]===publication)
          return result.map(log=>({...log,blockNumber:log.blockNumber===args[0].fromBlock?args[0].toBlock:args[0].fromBlock}));
        return result;
      };
      return serveCheckpointPortal(req,res,observed,'127.0.0.1:'+server.address().port);
    });
    server.listen(0,'127.0.0.1');await once(server,'listening');
    try{
      const url='http://127.0.0.1:'+server.address().port+'/checkpoint/following';
      const child=spawn('python3',[fileURLToPath(new URL('./test-following-heights.py',import.meta.url)),url,scenario],{stdio:'inherit'});
      const [code]=await once(child,'exit');if(code!==0)throw Error('Browser height regression: '+scenario);
    }finally{server.close();}
  }
}
