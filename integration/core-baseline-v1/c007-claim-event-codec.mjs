// Candidate static event layout only. Not receipt verification or fee admission.
import { id } from 'ethers';

export const candidateEvents = Object.freeze([
  'event ResearchFeeAdmitted(bytes32 indexed recordId,uint256 indexed payerAccount,uint256 epoch,uint256 nonce,uint256 fee,bytes32 stakeRoot,uint256 totalStake,uint256 payerStake,bytes32 profile)',
  'event ResearchFeeClaimed(bytes32 indexed recordId,uint256 indexed accountId,uint256 amount)'
]);
const admitted = id('ResearchFeeAdmitted(bytes32,uint256,uint256,uint256,uint256,bytes32,uint256,uint256,bytes32)');
const claimed = id('ResearchFeeClaimed(bytes32,uint256,uint256)');
const word = /^0x[0-9a-fA-F]{64}$/;
const address = /^0x[0-9a-fA-F]{40}$/;
function need(ok, code) { if (!ok) throw new Error(code); }

export function decodeCandidateLog(log, expectedEmitter) {
  need(typeof expectedEmitter === 'string' && address.test(expectedEmitter), 'EMITTER_SELECTION');
  need(log && Object.getPrototypeOf(log) === Object.prototype, 'LOG');
  need(Object.keys(log).length === 3 && ['address','topics','data'].every(k => Object.hasOwn(log,k)), 'FIELDS');
  need(typeof log.address === 'string' && address.test(log.address)
    && log.address.toLowerCase() === expectedEmitter.toLowerCase(), 'EMITTER');
  need(Array.isArray(log.topics) && log.topics.length === 3
    && log.topics.every(x => typeof x === 'string' && word.test(x)), 'TOPICS');
  const topic = log.topics[0].toLowerCase();
  need(topic === admitted || topic === claimed, 'EVENT');
  const words = topic === admitted ? 7 : 1;
  need(typeof log.data === 'string' && log.data.length === 2 + words * 64
    && /^0x[0-9a-fA-F]+$/.test(log.data), 'DATA');
  const hex = n => '0x' + log.data.slice(2+n*64,2+(n+1)*64).toLowerCase();
  const number = n => BigInt(hex(n)).toString();
  const common = { verification: 'UNVERIFIED_EVENT_LAYOUT_ONLY',
    emitter: log.address.toLowerCase(), recordId: log.topics[1].toLowerCase() };
  if (topic === admitted) return { ...common, kind: 'admission',
    payerAccount: BigInt(log.topics[2]).toString(), epoch: number(0), nonce: number(1),
    fee: number(2), stakeRoot: hex(3), totalStake: number(4), payerStake: number(5), profile: hex(6) };
  return { ...common, kind: 'claim', accountId: BigInt(log.topics[2]).toString(), amount: number(0) };
}
