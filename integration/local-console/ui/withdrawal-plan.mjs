const address = /^0x[0-9a-fA-F]{40}$/;
const hash = /^0x[0-9a-fA-F]{64}$/;
const quantity = /^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/;
const same = (a,b) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();
function uint(value) {
  if (!/^(?:0|[1-9][0-9]{0,77})$/.test(String(value))) throw Error('Invalid withdrawal number.');
  const n = BigInt(value);
  if (n >= 2n ** 256n) throw Error('Withdrawal number is too large.');
  return n.toString(16).padStart(64,'0');
}
// Fixed research ABI only: execute(custody, withdraw(account 2, epoch, amount)).
// Selectors and encoding are cross-checked against ethers in the test suite.
export function withdrawalData(custody, epoch, amount, ownerType='fixture-wallet') {
  if (!address.test(custody) || BigInt(amount) <= 0n) throw Error('Invalid withdrawal target or amount.');
  const inner = 'a41fe49f' + uint(2) + uint(epoch) + uint(amount);
  if(ownerType==='eoa')return '0x'+inner;
  if(ownerType!=='fixture-wallet')throw Error('Unsupported account owner.');
  return '0x1cff79cd' + custody.slice(2).toLowerCase().padStart(64,'0') + uint(64) + uint(inner.length/2) + inner.padEnd(Math.ceil(inner.length/64)*64,'0');
}
export function verifyWithdrawalPlan(plan, state, account, amount) {
  const type=state?.ownerType??'fixture-wallet',signer=state?.signer??state?.controller;
  const supported=type==='fixture-wallet'?same(state?.owner,state?.contracts?.wallet)&&same(signer,state?.controller):type==='eoa'&&same(state?.owner,signer)&&!Object.values(state?.contracts??{}).some(a=>same(a,signer));
  if (!state || !plan || !supported || !address.test(account) || /^0x0{40}$/i.test(account) || !same(account,signer) ||
      Object.hasOwn(plan,'action') || plan.chainId !== '0x7a69' ||
      !same(plan.from,account) || !same(plan.to,type==='fixture-wallet'?state.contracts.wallet:state.contracts.custody) || plan.value !== '0x0' ||
      plan.amount !== amount || plan.epoch !== state.epoch || BigInt(amount) > BigInt(state.credit) ||
      !hash.test(plan.genesisHash) || !same(plan.genesisHash,state.genesisHash) ||
      !hash.test(plan.blockHash) || !quantity.test(plan.blockNumber) ||
      !same(plan.data,withdrawalData(state.contracts.custody,state.epoch,amount,type))) {
    throw Error('Withdrawal bytes do not match the reviewed account, amount and destination. Refresh and try again.');
  }
  return true;
}
