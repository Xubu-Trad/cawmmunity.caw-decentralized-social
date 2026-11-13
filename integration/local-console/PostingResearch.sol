// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

interface IPostingRegistryResearch {
    function authority(uint256 accountId) external view returns (address owner, uint256 epoch);
}

/// @notice Unpaid local posting research. Not a paid CAW protocol or release.
/// Authorization is the native transaction/current account owner, including
/// the fixture wallet's direct execute path. No EIP-712, relay or session API.
/// Account 2, text limits and this profile are provisional research choices.
contract PostingResearch {
    IPostingRegistryResearch public immutable registry;
    bytes32 public immutable registryCodeHash;
    bytes32 public constant PROFILE = keccak256("LOCAL_REGISTRY_POST_V1");
    mapping(uint256 => uint256) public nextNonce;

    event LocalPostPublished(
        uint256 indexed accountId,
        uint256 indexed epoch,
        uint256 indexed nonce,
        address author,
        bytes32 textHash,
        bytes text
    );

    constructor(address registry_, bytes32 expectedRegistryCodeHash) {
        require(registry_ != address(0) && registry_.code.length != 0, "REGISTRY");
        require(expectedRegistryCodeHash != bytes32(0) && registry_.codehash == expectedRegistryCodeHash, "REGISTRY_CODE");
        registry = IPostingRegistryResearch(registry_);
        registryCodeHash = expectedRegistryCodeHash;
        (address owner,) = registry.authority(2);
        require(owner != address(0), "ZERO_OWNER");
    }

    function publish(uint256 accountId, uint256 epoch, uint256 nonce, bytes calldata text) external {
        require(accountId == 2, "ACCOUNT");
        require(address(registry).codehash == registryCodeHash, "REGISTRY_CODE");
        (address owner, uint256 currentEpoch) = registry.authority(accountId);
        require(owner != address(0), "ZERO_OWNER");
        require(msg.sender == owner, "OWNER");
        require(epoch == currentEpoch, "EPOCH");
        require(nonce == nextNonce[accountId], "NONCE");
        _validateUtf8Text(text);
        nextNonce[accountId] = nonce + 1;
        emit LocalPostPublished(accountId, epoch, nonce, owner, keccak256(text), text);
    }

    // Exact validator body retained from the frozen research source
    // DeployedCustodyStakeResearch.sol, SHA-256
    // d97dd9157a81611630ac876556684f7354f412e35a7a360662aab6ce2984e02c.
    // Provisional C-004 rule: Unicode scalar values, no normalization.
    function _validateUtf8Text(bytes calldata rawText)
        internal pure
    {
        uint256 n=rawText.length;
        require(n>0 && n<=1680, "TEXT_LENGTH");

        uint256 i=0;
        uint256 scalars=0;

        while(i<n){
            uint8 a=uint8(rawText[i]);
            uint256 width;

            if(a<=0x7f){
                width=1;
            } else if(a>=0xc2 && a<=0xdf){
                width=2;
            } else if(a>=0xe0 && a<=0xef){
                width=3;
            } else if(a>=0xf0 && a<=0xf4){
                width=4;
            } else {
                revert("UTF8");
            }

            if(i+width>n) revert("UTF8");

            uint8 b=0;
            if(width>=2){
                b=uint8(rawText[i+1]);
                if((b & 0xc0)!=0x80) revert("UTF8");
            }

            if(width>=3){
                uint8 c=uint8(rawText[i+2]);
                if((c & 0xc0)!=0x80) revert("UTF8");

                if(a==0xe0 && b<0xa0) revert("UTF8");
                if(a==0xed && b>=0xa0) revert("UTF8");
            }

            if(width==4){
                uint8 d=uint8(rawText[i+3]);
                if((d & 0xc0)!=0x80) revert("UTF8");

                if(a==0xf0 && b<0x90) revert("UTF8");
                if(a==0xf4 && b>0x8f) revert("UTF8");
            }

            i+=width;
            scalars++;
            if(scalars>420) revert("TEXT_LENGTH");
        }
    }
}
