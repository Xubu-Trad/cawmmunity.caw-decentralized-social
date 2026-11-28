// Build the browser-only suffix offline from the public disposable test accounts.
import {readFileSync} from 'node:fs';
import {HDNodeWallet,Interface,Transaction,parseEther} from 'ethers';

const fixture=JSON.parse(readFileSync(process.argv[2]));
const {contracts}=JSON.parse(readFileSync(new URL('./disposable-runtime.json',import.meta.url)));
const wallet=i=>HDNodeWallet.fromPhrase('test test test test test test test test test test test junk','',`m/44'/60'/0'/0/${i}`);
const author=wallet(0),owner=wallet(4);
const members=[wallet(1).address,wallet(3).address].sort((a,b)=>BigInt(a)<BigInt(b)?-1:1);
const token=new Interface(['function transfer(address,uint256)','function approve(address,uint256)']);
const follows=new Interface(['function follow(string,string,address,address[])']);
const nonces=new Map();
for(const {transactions} of fixture.blocks)for(const raw of transactions){
  const tx=Transaction.from(raw);
  nonces.set(tx.from,tx.nonce+1);
}
const fee=parseEther('30000');
async function sign(signer,to,data){
  const nonce=nonces.get(signer.address)??0;
  nonces.set(signer.address,nonce+1);
  return signer.signTransaction({chainId:1337,type:2,to,data,nonce,gasLimit:500000,maxFeePerGas:1000000000,maxPriorityFeePerGas:0});
}
console.log(JSON.stringify([
  await sign(author,contracts.token.address,token.encodeFunctionData('transfer',[owner.address,fee])),
  await sign(owner,contracts.token.address,token.encodeFunctionData('approve',[contracts.follow.address,fee])),
  await sign(owner,contracts.follow.address,follows.encodeFunctionData('follow',['reader01','hunter01',author.address,members]))
]));
