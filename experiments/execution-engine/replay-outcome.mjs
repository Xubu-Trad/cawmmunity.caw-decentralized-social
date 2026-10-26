// Summarizes one trusted engine invocation. Does not authenticate execution or compare state.
export async function runWitnessAttempt(adapter,execute){
  const report=(kind,extra={})=>Object.freeze({schema:'caw-replay-outcome/1',kind,...extra,
    stateComparisonVerified:false,stateRootRecomputed:false,publicChainAuthenticated:false,productionAccepted:false});
  try{
    adapter.healthy();
    const result=await execute();
    adapter.healthy(); // A swallowed missing-witness error must never become a receipt.
    const error=result?.execResult?.exceptionError?.error;
    if(typeof result?.totalGasSpent!=='bigint'||result.totalGasSpent<0n||
       ![0,1].includes(result?.receipt?.status))return report('unclassified-failure');
    if(error==='revert'&&result.receipt.status===0)
      return report('execution-reverted',{gasUsed:result.totalGasSpent.toString()});
    if(error===undefined&&result.receipt.status===1)
      return report('execution-completed',{gasUsed:result.totalGasSpent.toString()});
    return report('unclassified-failure');
  }catch(error){
    const code=error?.code;
    if(code==='WITNESS_STATE_MISSING_ACCOUNT'||code==='WITNESS_STATE_MISSING_SLOT')return report('missing-evidence');
    if(code==='WITNESS_ADAPTER_LIMIT')return report('local-resource-limit');
    if(code==='WITNESS_ADAPTER_UNSUPPORTED')return report('unsupported-operation');
    return report('unclassified-failure');
  }finally{adapter.overlay.discard();}
}
