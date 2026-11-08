// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
// Research fixture, not an audited custody wallet. No key rotation or recovery.
contract SignerWalletFixture {
 address public immutable controller;
 constructor(address c) { require(c!=address(0),"ZERO_CONTROLLER"); controller=c; }
 function execute(address target,bytes calldata data) external returns(bytes memory) {
  require(msg.sender==controller,"CONTROLLER");
  (bool ok,bytes memory result)=target.call(data);
  if(!ok) assembly { revert(add(result,32),mload(result)) }
  return result;
 }
 function isValidSignature(bytes32 digest,bytes calldata signature) external view returns(bytes4) {
  if(signature.length!=65) return 0xffffffff;
  bytes32 r; bytes32 s; uint8 v;
  assembly { r:=calldataload(signature.offset) s:=calldataload(add(signature.offset,32)) v:=byte(0,calldataload(add(signature.offset,64))) }
  if(v!=27 && v!=28) return 0xffffffff;
  if(uint256(s)==0 || uint256(s)>0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0) return 0xffffffff;
  address signer=ecrecover(digest,v,r,s);
  return signer!=address(0) && signer==controller ? bytes4(0x1626ba7e) : bytes4(0xffffffff);
 }
}
