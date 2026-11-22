// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

// Negative-control assets only. Not CAW and not production contracts.
contract UnfundedTokenFixture {
    mapping(address => uint256) public balanceOf;
    constructor() { balanceOf[msg.sender] = 100; }
    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount);
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract UnfundedEmitterResearch {
    address public immutable token;
    bytes32 public constant PROFILE = bytes32(uint256(0x3333333333333333333333333333333333333333333333333333333333333333));
    event ResearchFeeAdmitted(bytes32 indexed recordId,uint256 indexed payerAccount,uint256 epoch,uint256 nonce,uint256 fee,bytes32 stakeRoot,uint256 totalStake,uint256 payerStake,bytes32 profile);
    event ResearchFeeClaimed(bytes32 indexed recordId,uint256 indexed accountId,uint256 amount);
    constructor(address token_) { token = token_; }
    function emitWithoutPayment(bytes32 root) external {
        bytes32 recordId = sha256(abi.encodePacked(
            "CAW_C007_CLAIM_RECORD_RESEARCH_V1", bytes1(0),
            uint256(block.chainid), address(this), PROFILE,
            uint256(1), uint256(0), uint256(0), uint256(5), root, uint256(10)
        ));
        // Deliberately false economic statements: no token transfer or account debit.
        emit ResearchFeeAdmitted(recordId,1,0,0,5,root,10,2,PROFILE);
        emit ResearchFeeClaimed(recordId,3,4);
    }
}
