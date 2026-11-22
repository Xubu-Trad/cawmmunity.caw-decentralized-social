import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {keccak256Hex} from './ui/keccak256.mjs';
import {postText,postData,verifyPostPlan,POST_PROFILE,POST_EVENT_TOPIC} from './ui/post-plan.mjs';
const {Interface,keccak256,toUtf8Bytes}=createRequire(import.meta.url)('ethers');
const a=n=>'0x'+n.repeat(40),h=n=>'0x'+n.repeat(64);
const state={chainId:'0x7a69',controller:a('1'),owner:a('2'),ownerType:'fixture-wallet',signer:a('1'),epoch:'3',credit:'100',genesisHash:h('1'),contracts:{wallet:a('2'),registry:a('3'),custody:a('4'),token:a('5'),posting:a('6')},posting:{nonce:'7',profile:POST_PROFILE}};
const text=' caw 🌒\n日本語 e\u0301 ';
function plan(s=state,t=text){return {action:'post',owner:s.owner,posting:s.contracts.posting,epoch:s.epoch,postNonce:s.posting.nonce,text:t,textHash:postText(t).textHash,profile:POST_PROFILE,chainId:s.chainId,from:s.signer,to:s.ownerType==='eoa'?s.contracts.posting:s.contracts.wallet,data:postData(s.contracts.posting,s.epoch,s.posting.nonce,t,s.ownerType),value:'0x0',blockHash:h('2'),blockNumber:'0x5',genesisHash:s.genesisHash};}
const publishing=new Interface(['function publish(uint256,uint256,uint256,bytes)']),wallet=new Interface(['function execute(address,bytes)']);

test('browser hash matches Ethereum known vectors and independent ethers for rate boundaries',()=>{
 assert.equal(keccak256Hex('0x'),'0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470');
 for(const n of [0,1,31,32,135,136,137,272,1680,65536]){const bytes=Uint8Array.from({length:n},(_,i)=>i%256),raw='0x'+Buffer.from(bytes).toString('hex');assert.equal(keccak256Hex(raw),keccak256(bytes));}
 assert.equal(POST_PROFILE,keccak256(toUtf8Bytes('LOCAL_REGISTRY_POST_V1')));
 assert.equal(POST_EVENT_TOPIC,keccak256(toUtf8Bytes('LocalPostPublished(uint256,uint256,uint256,address,bytes32,bytes)')));
});
for(const raw of ['0x0','0xAA','abc','0x'+'ab'.repeat(65537),null])test('rejects unsupported Keccak input '+String(raw).slice(0,20),()=>assert.throws(()=>keccak256Hex(raw)));
for(const t of [text,'x','🌒'.repeat(420),'a'.repeat(420),'\0\n\t','é','e\u0301'])test('exact post bytes and calldata match independent ethers '+JSON.stringify(t).slice(0,40),()=>{
 const info=postText(t);assert.equal(info.bytesHex,'0x'+Buffer.from(t,'utf8').toString('hex'));assert.equal(info.textHash,keccak256(toUtf8Bytes(t)));
 const inner=publishing.encodeFunctionData('publish',[2,3,7,info.bytesHex]);
 assert.equal(postData(state.contracts.posting,'3','7',t,'eoa'),inner);
 assert.equal(postData(state.contracts.posting,'3','7',t),wallet.encodeFunctionData('execute',[state.contracts.posting,inner]));
 assert.equal(verifyPostPlan(plan(state,t),state,state.signer,t),true);
});
test('combining text remains distinct from normalized text',()=>assert.notEqual(postText('é').textHash,postText('e\u0301').textHash));
for(const t of ['',null,3,'a'.repeat(421),'🌒'.repeat(421),'\ud800','\udfff','a\ud800b','\udc00\ud800'])test('rejects invalid scalar text '+JSON.stringify(t).slice(0,30),()=>assert.throws(()=>postText(t)));
test('420 supplementary scalars reach exactly 1680 UTF-8 bytes',()=>assert.deepEqual(postText('🌒'.repeat(420)),{bytesHex:'0x'+'f09f8c92'.repeat(420),textHash:keccak256(toUtf8Bytes('🌒'.repeat(420))),scalars:420,byteLength:1680}));
test('plain EOA owner signs a direct post',()=>{const s={...state,ownerType:'eoa',owner:a('7'),signer:a('7')};assert.equal(verifyPostPlan(plan(s),s,s.signer,text),true);});
for(const [field,value]of [['action','transfer'],['owner',a('8')],['posting',a('8')],['from',a('8')],['to',a('8')],['epoch','4'],['epoch','03'],['epoch',(2n**256n).toString()],['postNonce','8'],['postNonce','07'],['postNonce',(2n**256n).toString()],['text',text+' '],['textHash',h('0')],['profile',h('0')],['chainId','0x1'],['value','0x1'],['blockHash','0x'],['blockNumber','0x00'],['genesisHash',h('0')],['data','0x1234'],['amount','1'],['recipient',a('9')]])test('rejects post plan '+field+' '+String(value).slice(0,20),()=>assert.throws(()=>verifyPostPlan({...plan(),[field]:value},state,state.signer,text)));
test('rejects changed current nonce and profile',()=>{assert.throws(()=>verifyPostPlan(plan(),{...state,posting:{...state.posting,nonce:'8'}},state.signer,text));assert.throws(()=>verifyPostPlan(plan(),{...state,posting:{...state.posting,profile:h('0')}},state.signer,text));});
test('uint256 maximum remains encodable; overflow is rejected',()=>{const max=(2n**256n-1n).toString();assert.equal(postData(a('6'),max,max,'x','eoa'),publishing.encodeFunctionData('publish',[2,max,max,'0x78']));assert.throws(()=>postData(a('6'),(2n**256n).toString(),'0','x'));});
