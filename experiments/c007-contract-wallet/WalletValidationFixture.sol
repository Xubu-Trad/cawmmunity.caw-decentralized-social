// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
// Deliberately configurable test wallet; not a custody wallet for deployment.
contract WalletValidationFixture {
    bytes32 public digest; bytes32 public signatureHash; uint256 public mode; uint256 public writes;
    function configure(bytes32 d,bytes32 s,uint256 m) external {digest=d;signatureHash=s;mode=m;}
    function isValidSignature(bytes32 d,bytes calldata sig) external returns(bytes4){
        require(d==digest && keccak256(sig)==signatureHash,"MISMATCH");
        if(mode==1)return 0xffffffff;
        if(mode==2)revert("WALLET_REVERT");
        if(mode==3){assembly{mstore(0,shl(224,0x1626ba7e)) return(0,4)}}
        if(mode==4){assembly{return(0,0)}}
        if(mode==5){writes=1;}
        if(mode==6){assembly{for {} 1 {} {}}}
        if(mode==7){assembly{mstore(0,shl(224,0x1626ba7e)) return(0,8192)}}
        return 0x1626ba7e;
    }
}
