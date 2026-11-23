import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';

export function gethTransition(alloc, header, transactions, blockHashes) {
  const executable=process.env.GETH_EVM;
  assert.ok(executable,'Set GETH_EVM to the pinned Geth evm binary');
  const env={currentCoinbase:header.miner,currentGasLimit:header.gasLimit,currentNumber:header.number,
    currentTimestamp:header.timestamp,currentBaseFee:header.baseFeePerGas,currentRandom:header.mixHash,
    withdrawals:[],blockHashes};
  const output=execFileSync(executable,['t8n','--state.fork=Shanghai','--state.chainid=1337','--state.reward=-1',
    '--input.alloc=stdin','--input.env=stdin','--input.txs=stdin','--output.result=stdout','--output.alloc=stdout'],
    {input:JSON.stringify({alloc,env,txs:transactions}),timeout:15000,maxBuffer:8*1024*1024});
  const next=JSON.parse(output);
  assert.equal(next.result.rejected?.length??0,0,'Geth rejected signed transaction');
  return next;
}

export function checkGethBinary(){
  const digest=createHash('sha256').update(readFileSync(process.env.GETH_EVM)).digest('hex');
  assert.equal(digest,'d8cfddad15a8c601e7b069bc5973ad073dbc2d632b8c5ab50e513ef27c53d6da');
}
