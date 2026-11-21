// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

// Disposable test token, including an intentionally unsafe failure-mode switch.
contract AdmissionTokenFixture {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    bool public returnFalse;
    constructor() { balanceOf[msg.sender] = 100; }
    function setReturnFalse(bool value) external { returnFalse = value; }
    function approve(address spender,uint256 amount) external returns(bool) {
        allowance[msg.sender][spender]=amount;return true;
    }
    function transfer(address to,uint256 amount) external returns(bool) {
        require(balanceOf[msg.sender]>=amount,"FUNDS");
        balanceOf[msg.sender]-=amount;balanceOf[to]+=amount;return true;
    }
    function transferFrom(address from,address to,uint256 amount) external returns(bool) {
        require(allowance[from][msg.sender]>=amount,"ALLOWANCE");
        require(balanceOf[from]>=amount,"FUNDS");
        allowance[from][msg.sender]-=amount;balanceOf[from]-=amount;balanceOf[to]+=amount;
        return !returnFalse; // false AFTER mutation exercises transaction rollback
    }
}
interface IAdmissionTokenResearch {
    function balanceOf(address) external view returns(uint256);
    function transferFrom(address,address,uint256) external returns(bool);
}

// One fixed research payer; no NFT registration, staking, claims or withdrawal.
// Five mock base units are an experimental input, not an adopted CAW fee.
contract FundedAdmissionResearch {
    IAdmissionTokenResearch public immutable token;
    address public immutable payer;
    bytes32 public immutable snapshotRoot;
    uint256 public nextNonce;
    uint256 public unclaimedLiability;
    mapping(bytes32=>uint256) public budgets;
    uint256 private entered;
    bytes32 public constant PROFILE=0x3333333333333333333333333333333333333333333333333333333333333333;
    event ResearchFeeAdmitted(bytes32 indexed recordId,uint256 indexed payerAccount,uint256 epoch,uint256 nonce,uint256 fee,bytes32 stakeRoot,uint256 totalStake,uint256 payerStake,bytes32 profile);
    constructor(address token_,address payer_,bytes32 root_) {
        require(token_.code.length!=0 && payer_!=address(0));
        token=IAdmissionTokenResearch(token_);payer=payer_;snapshotRoot=root_;
    }
    function recordIdFor(uint256 nonce) public view returns(bytes32) {
        return sha256(abi.encodePacked("CAW_C007_CLAIM_RECORD_RESEARCH_V1",bytes1(0),
            uint256(block.chainid),address(this),PROFILE,uint256(1),uint256(0),nonce,
            uint256(5),snapshotRoot,uint256(10)));
    }
    function admit(uint256 nonce) external {
        require(entered==0,"REENTRY");entered=1;
        require(msg.sender==payer,"PAYER");require(nonce==nextNonce,"NONCE");
        bytes32 id=recordIdFor(nonce);require(budgets[id]==0,"DUPLICATE");
        uint256 beforePayer=token.balanceOf(payer);
        uint256 beforeVault=token.balanceOf(address(this));
        require(beforePayer>=5,"FUNDS");
        require(token.transferFrom(payer,address(this),5),"TOKEN_FALSE");
        require(token.balanceOf(payer)==beforePayer-5,"DEBIT");
        require(token.balanceOf(address(this))==beforeVault+5,"CREDIT");
        nextNonce=nonce+1;budgets[id]=5;unclaimedLiability+=5;
        require(token.balanceOf(address(this))>=unclaimedLiability,"BACKING");
        emit ResearchFeeAdmitted(id,1,0,nonce,5,snapshotRoot,10,2,PROFILE);
        entered=0;
    }
}
