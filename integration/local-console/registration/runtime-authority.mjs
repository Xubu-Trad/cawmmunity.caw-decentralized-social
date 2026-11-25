import {Interface, ZeroHash, id, toBeHex} from 'ethers';

// These descriptions apply only after the caller matches all seven pinned runtimes.
const policies={
  token:'Holders transfer balances and set allowances. Approved spenders can transfer within their allowance.',
  registry:'Anyone can register an available name for the quoted payment. The NFT owner, approved address or approved operator can transfer it.',
  posts:'Stakers can change their own stake. The current username owner can publish.',
  likes:'The current username owner can like. Anyone can submit a valid historical post proof.',
  recaw:'The current username owner can reCAW a proven post.',
  follow:'The current username owner can follow another name. The transaction checks its reviewed recipient.',
  vault:'The current NFT owner can deposit and withdraw for that account at the current ownership epoch.'
};
const proxySlots=Object.fromEntries(['implementation','admin','beacon'].map(name=>
  [name,toBeHex(BigInt(id('eip1967.proxy.'+name))-1n,32)]));

async function call(rpc,at,address,signature,args=[]){
  const iface=new Interface(['function '+signature]);
  const fn=iface.fragments[0];
  const data=iface.encodeFunctionData(fn,args);
  const raw=await rpc('eth_call',[{to:address,data},at]);
  const result=iface.decodeFunctionResult(fn,raw);
  if(iface.encodeFunctionResult(fn,result).toLowerCase()!==raw.toLowerCase())
    throw Error('Malformed authority response: '+fn.name);
  return result;
}

// The seven hash-pinned Solidity runtimes all have an INVALID separator and CBOR trailer.
export function checkUpgradeOpcodes(role,code){
  const bytes=Buffer.from(code.slice(2),'hex');
  const end=bytes.length-2-bytes.readUInt16BE(bytes.length-2);
  if(end<=0 || bytes[end-1]!==0xfe || bytes[end]!==0xa2)throw Error(role+': unexpected metadata boundary');
  for(let offset=0;offset<end;offset++){
    const op=bytes[offset];
    if(op===0xf2 || op===0xf4 || op===0xff)throw Error(role+': unexpected CALLCODE, DELEGATECALL or SELFDESTRUCT at '+offset);
    if(op>=0x60 && op<=0x7f)offset+=op-0x5f;
  }
}

export async function readAuthority(rpc,at,contracts,name){
  const addr=role=>contracts[role].address;
  const bindings={
    token:{},
    registry:{paymentToken:addr('token'),SINK:'0xdEAD000000000000000042069420694206942069',CAW_RUNTIME:contracts.token.runtimeKeccak256},
    posts:{registry:addr('registry'),token:addr('token')},
    likes:{pool:addr('posts')},
    recaw:{pool:addr('posts'),source:addr('likes')},
    follow:{pool:addr('posts')},
    vault:{registry:addr('registry'),TOKEN:addr('token'),registryCodeHash:contracts.registry.runtimeKeccak256}
  };
  const report={};
  for(const [role,checks] of Object.entries(bindings)){
    const address=addr(role), dependencies={};
    for(const [slot,key] of Object.entries(proxySlots)){
      const word=await rpc('eth_getStorageAt',[address,key,at]);
      if(word!==ZeroHash)throw Error(role+': unexpected EIP-1967 '+slot+' slot: '+word);
    }
    for(const [getter,expected] of Object.entries(checks)){
      const type=expected.length===66?'bytes32':'address';
      const [actual]=await call(rpc,at,address,getter+'() view returns ('+type+')');
      if(actual!==expected)throw Error(role+': unexpected '+getter+' binding');
      dependencies[getter]=actual;
    }
    report[role]={address,accountPermissions:policies[role],protocolAdmin:'none identified in pinned runtime',
      upgrade:'no upgrade entry point identified; EIP-1967 slots empty; no CALLCODE, DELEGATECALL or SELFDESTRUCT in the scanned instructions',dependencies};
  }
  if(name!==undefined){
    if(!/^[a-z0-9]+$/.test(name))throw Error('Expected a lowercase registered username.');
    const tokenId=id(name),registry=addr('registry');
    const [owner,epoch]=await call(rpc,at,registry,'authority(uint256) view returns (address,uint256)',[tokenId]);
    const [nftOwner]=await call(rpc,at,registry,'ownerOf(uint256) view returns (address)',[tokenId]);
    if(nftOwner!==owner)throw Error('NFT owner and authority disagree.');
    const [approved]=await call(rpc,at,registry,'getApproved(uint256) view returns (address)',[tokenId]);
    report.registry.username={name,owner,epoch:String(epoch),approvedForTransfer:approved};
  }
  return report;
}
