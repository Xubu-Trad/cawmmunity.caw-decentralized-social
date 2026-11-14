// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
// Test-only wallet: configuration stands in for a signer scheme.
contract LifecycleWalletFixture {
 address public immutable controller;
 bytes32 public digest; bytes32 public signatureHash; bool public reject;
 constructor(address c) { controller=c; }
 function configure(bytes32 d,bytes32 h,bool r) external {
  require(msg.sender==controller,"CONTROLLER"); digest=d; signatureHash=h; reject=r;
 }
 function execute(address target,bytes calldata data) external returns(bytes memory) {
  require(msg.sender==controller,"CONTROLLER");
  (bool ok,bytes memory result)=target.call(data);
  if(!ok) assembly { revert(add(result,32),mload(result)) }
  return result;
 }
 function isValidSignature(bytes32 d,bytes calldata signature) external view returns(bytes4) {
  require(!reject && d==digest && keccak256(signature)==signatureHash,"REJECT");
  return 0x1626ba7e;
 }
}
