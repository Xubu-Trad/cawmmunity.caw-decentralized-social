import {Interface, formatEther, getAddress} from 'ethers';

const pool = new Interface([
  'function stake(uint256)', 'function unstake()', 'function stakeOf(address) view returns(uint256)',
  'function totalStake() view returns(uint256)'
]);

// This bounded reconstruction assumes the configured local pool and fixture token.
export async function readStakeWindow(rpc, block, index, address, author, paid, eligible) {
  if (block.transactions.length !== 3 || index !== 1) return null;
  const positions = [0, 2];
  const neighbors = await Promise.all(positions.map(i =>
    rpc('eth_getTransactionByHash', [block.transactions[i]])));
  for (const [j, tx] of neighbors.entries()) {
    const i = positions[j];
    if (tx?.blockHash !== block.hash || tx.hash !== block.transactions[i] || tx.transactionIndex !== '0x'+i.toString(16))
      throw Error('Stake window transaction inclusion mismatch.');
  }
  const [entry, exit] = neighbors;
  if (entry.to?.toLowerCase() !== address.toLowerCase() || exit.to?.toLowerCase() !== address.toLowerCase() ||
      getAddress(entry.from) !== getAddress(exit.from) || !entry.input.toLowerCase().startsWith(pool.getFunction('stake').selector) ||
      exit.input.toLowerCase() !== pool.encodeFunctionData('unstake')) return null;
  const receipts = await Promise.all(neighbors.map(tx => rpc('eth_getTransactionReceipt', [tx.hash])));
  for (const [j, receipt] of receipts.entries()) {
    if (receipt?.blockHash !== block.hash || receipt.transactionHash !== neighbors[j].hash ||
        receipt.transactionIndex !== '0x'+positions[j].toString(16)) throw Error('Stake window receipt inclusion mismatch.');
  }
  if (receipts.some(r => !['0x0','0x1'].includes(r.status))) throw Error('Invalid receipt status.');
  if (receipts.some(r => r.status !== '0x1')) return null;
  const participant = getAddress(entry.from);
  const [added] = pool.decodeFunctionData('stake', entry.input);
  if (pool.encodeFunctionData('stake',[added]) !== entry.input.toLowerCase()) return null;
  const limit=(1n<<128n)-1n;
  if (added===0n || added>limit) throw Error('Impossible stake amount.');
  async function state(hash, method, args = []) {
    const result = await rpc('eth_call', [{to:address, data:pool.encodeFunctionData(method,args)},
      {blockHash:hash, requireCanonical:true}]);
    if(typeof result!=='string' || !/^0x[0-9a-fA-F]{64}$/.test(result)) throw Error('Malformed stake state.');
    return pool.decodeFunctionResult(method,result)[0];
  }
  const parentWeights=new Map();
  function before(account){
    const key=getAddress(account);
    if(!parentWeights.has(key)) parentWeights.set(key,state(block.parentHash,'stakeOf',[key]));
    return parentWeights.get(key);
  }
  const [start, end, old, after, authorBefore] = await Promise.all([
    state(block.parentHash,'totalStake'), state(block.hash,'totalStake'), before(participant),
    state(block.hash,'stakeOf',[participant]), before(author)
  ]);
  const authorAddress=getAddress(author);
  const expected = start + added - authorBefore - (participant === authorAddress ? added : 0n);
  if (old>start || authorBefore>start || start+added>limit || after !== 0n || end !== start-old || expected !== eligible)
    throw Error('Stake window boundary or eligible total mismatch.');
  const recipients=new Set();
  let totalWeight=0n;
  for(const {staker,weight} of paid){
    const recipient=getAddress(staker);
    if(recipient===authorAddress || recipients.has(recipient) || weight<=0n)
      throw Error('Invalid stake window recipient.');
    recipients.add(recipient);
    const parentWeight=await before(recipient);
    if(parentWeight>start)throw Error('Recipient weight exceeds parent stake.');
    const reconstructed=parentWeight+(recipient===participant ? added : 0n);
    if(weight!==reconstructed)throw Error('Stake window recipient weight mismatch.');
    totalWeight+=weight;
  }
  if(participant!==authorAddress && !recipients.has(participant))
    throw Error('Missing stake window participant in settlement.');
  if(totalWeight!==expected)throw Error('Stake window paid weight does not match eligible total.');
  return {participant, stakeTransaction:entry.hash, exitTransaction:exit.hash, parentHash:block.parentHash,
    before:formatEther(old), atPublication:formatEther(old+added), after:formatEther(after),
    eligible:formatEther(expected)};
}


class EvidenceUnavailable extends Error {}

export async function optionalStakeWindow(rpc,...args){
  async function read(method,params){
    let value;
    try { value=await rpc(method,params); }
    catch { throw new EvidenceUnavailable(); }
    if(value==null) throw new EvidenceUnavailable();
    return value;
  }
  try {
    const stakeWindow=await readStakeWindow(read,...args);
    return stakeWindow ? {stakeWindow} : {};
  } catch(error){
    return {stakeWindowStatus:error instanceof EvidenceUnavailable?'unavailable':'conflicting'};
  }
}
