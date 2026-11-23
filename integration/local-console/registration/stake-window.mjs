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
    if (tx?.blockHash !== block.hash || tx.hash !== block.transactions[i] || BigInt(tx.transactionIndex) !== BigInt(i))
      throw Error('Stake window transaction inclusion mismatch.');
  }
  const [entry, exit] = neighbors;
  if (entry.to?.toLowerCase() !== address.toLowerCase() || exit.to?.toLowerCase() !== address.toLowerCase() ||
      entry.from !== exit.from || !entry.input.startsWith(pool.getFunction('stake').selector) ||
      exit.input !== pool.encodeFunctionData('unstake')) return null;
  const receipts = await Promise.all(neighbors.map(tx => rpc('eth_getTransactionReceipt', [tx.hash])));
  for (const [j, receipt] of receipts.entries()) {
    if (receipt?.blockHash !== block.hash || receipt.transactionHash !== neighbors[j].hash ||
        BigInt(receipt.transactionIndex) !== BigInt(positions[j])) throw Error('Stake window receipt inclusion mismatch.');
  }
  if (receipts.some(r => r.status !== '0x1')) return null;
  const participant = getAddress(entry.from);
  const [added] = pool.decodeFunctionData('stake', entry.input);
  async function state(hash, method, args = []) {
    const result = await rpc('eth_call', [{to:address, data:pool.encodeFunctionData(method,args)},
      {blockHash:hash, requireCanonical:true}]);
    return pool.decodeFunctionResult(method,result)[0];
  }
  const before = account => state(block.parentHash, 'stakeOf', [account]);
  const [start, end, old, after, authorBefore] = await Promise.all([
    state(block.parentHash,'totalStake'), state(block.hash,'totalStake'), before(participant),
    state(block.hash,'stakeOf',[participant]), before(author)
  ]);
  const expected = start + added - authorBefore - (participant === author ? added : 0n);
  if (after !== 0n || end !== start-old || expected !== eligible)
    throw Error('Stake window boundary or eligible total mismatch.');
  await Promise.all(paid.map(async ({staker,weight}) => {
    if (weight !== await before(staker) + (staker === participant ? added : 0n))
      throw Error('Stake window recipient weight mismatch.');
  }));
  return {participant, stakeTransaction:entry.hash, exitTransaction:exit.hash, parentHash:block.parentHash,
    before:formatEther(old), atPublication:formatEther(old+added), after:formatEther(after),
    eligible:formatEther(expected)};
}
