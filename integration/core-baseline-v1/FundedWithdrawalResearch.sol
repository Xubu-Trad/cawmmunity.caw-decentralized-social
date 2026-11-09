// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

// Disposable test token, including an intentionally unsafe failure-mode switch.
contract AdmissionTokenFixture {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    bool public returnFalse;
    // Unrestricted controls are adversarial TEST instrumentation only.
    uint256 public outboundMode;
    address public callbackTarget;bytes public callbackData;
    uint256 public callbackCount;bool public callbackSuccess;bytes public callbackResult;
    function setOutboundMode(uint256 mode) external {outboundMode=mode;}
    function setCallback(address target,bytes calldata data) external {callbackTarget=target;callbackData=data;}

    constructor() { balanceOf[msg.sender] = 100; }
    function setReturnFalse(bool value) external { returnFalse = value; }
    function approve(address spender,uint256 amount) external returns(bool) {
        allowance[msg.sender][spender]=amount;return true;
    }
    function transfer(address to,uint256 amount) external returns(bool) {
        require(balanceOf[msg.sender]>=amount,"FUNDS");
        balanceOf[msg.sender]-=amount;
        balanceOf[to]+=outboundMode==3?amount-1:amount;
        if(outboundMode==4)balanceOf[msg.sender]-=1;
        if(callbackTarget!=address(0)){callbackCount++;(callbackSuccess,callbackResult)=callbackTarget.call(callbackData);}
        require(outboundMode!=2,"TOKEN_REVERT");return outboundMode!=1;
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
    function transfer(address,uint256) external returns(bool);
}

// Experimental account-bound credits and direct owner withdrawals; no NFT registry.
// Five mock base units are an experimental input, not an adopted CAW fee.
contract FundedAdmissionResearch {
    IAdmissionTokenResearch public immutable token;
    address public immutable payer;
    bytes32 public immutable snapshotRoot;
    uint256 public nextNonce;
    uint256 public unpaidLiability;
    uint256 public unallocatedBudget;
    mapping(bytes32=>uint256) public budgets;
    uint256 private entered;
    bytes32 public constant PROFILE=0x3333333333333333333333333333333333333333333333333333333333333333;
    event ResearchFeeAdmitted(bytes32 indexed recordId,uint256 indexed payerAccount,uint256 epoch,uint256 nonce,uint256 fee,bytes32 stakeRoot,uint256 totalStake,uint256 payerStake,bytes32 profile);
    constructor(address token_,address payer_,bytes32 root_,address[3] memory owners_) {
        require(token_.code.length!=0 && payer_!=address(0));
        for(uint256 i=0;i<3;i++){require(owners_[i]!=address(0),"ZERO_OWNER");owners[i+2]=owners_[i];}
        token=IAdmissionTokenResearch(token_);payer=payer_;snapshotRoot=root_;
    }
    function recordIdFor(uint256 nonce) public view returns(bytes32) {
        return sha256(abi.encodePacked("CAW_C007_CLAIM_RECORD_RESEARCH_V1",bytes1(0),
            uint256(block.chainid),address(this),PROFILE,uint256(1),uint256(0),nonce,
            uint256(5),snapshotRoot,uint256(10)));
    }
    function admit(uint256 nonce) external guarded {
        require(msg.sender==payer,"PAYER");require(nonce==nextNonce,"NONCE");
        bytes32 id=recordIdFor(nonce);require(budgets[id]==0,"DUPLICATE");
        uint256 beforePayer=token.balanceOf(payer);
        uint256 beforeVault=token.balanceOf(address(this));
        require(beforePayer>=5,"FUNDS");
        require(token.transferFrom(payer,address(this),5),"TOKEN_FALSE");
        require(token.balanceOf(payer)==beforePayer-5,"DEBIT");
        require(token.balanceOf(address(this))==beforeVault+5,"CREDIT");
        nextNonce=nonce+1;budgets[id]=5;unpaidLiability+=5;unallocatedBudget+=5;
        require(token.balanceOf(address(this))>=unpaidLiability,"BACKING");
        emit ResearchFeeAdmitted(id,1,0,nonce,5,snapshotRoot,10,2,PROFILE);
    }

    // Constructor-owner fixture only. No adopted NFT beneficiary policy.
    mapping(bytes32=>mapping(uint256=>bool)) public claimed;
    mapping(uint256=>uint256) public credits;
    uint256 public creditedLiability;
    event ResearchFeeClaimed(bytes32 indexed recordId,uint256 indexed accountId,uint256 amount);
    function proofPrefix(uint256 account,uint256 weight,bytes32[] calldata hashes,uint256[] calldata sums) public view returns(uint256 prefix) {
        require(hashes.length==256 && sums.length==256,"PROOF_LENGTH");
        bytes32 node=sha256(abi.encodePacked(bytes1(0x01),account,weight));
        uint256 total=weight;
        for(uint256 h=0;h<256;h++) {
            uint256 sibling=sums[h];
            if(((account>>h)&1)!=0) {
                prefix+=sibling;
                node=sha256(abi.encodePacked(bytes1(0x02),hashes[h],sibling,node,total));
            } else node=sha256(abi.encodePacked(bytes1(0x02),node,total,hashes[h],sibling));
            total+=sibling;
        }
        require(total==10,"TOTAL");
        require(sha256(abi.encodePacked("CAW_STAKE_TREE_RESEARCH_V1",bytes1(0),bytes32(uint256(0x1111111111111111111111111111111111111111111111111111111111111111)),node,total))==snapshotRoot,"ROOT");
    }
    function claim(uint256 nonce,uint256 account,uint256 weight,bytes32[] calldata hashes,uint256[] calldata sums,bytes32[] calldata payerHashes,uint256[] calldata payerSums) external guarded {
        require(nonce<nextNonce,"UNKNOWN_RECORD");
        require(account!=1,"PAYER");
        bytes32 id=recordIdFor(nonce);
        require(!claimed[id][account],"CLAIMED");
        proofPrefix(1,2,payerHashes,payerSums);
        uint256 prefix=proofPrefix(account,weight,hashes,sums);
        uint256 start=prefix-(account>1?2:0);
        // Bounded fee5 / total10 fixture only; not general uint256 mulDiv.
        uint256 amount=(5*(start+weight))/8-(5*start)/8;
        creditRecord(id,account,amount);
    }
    function creditRecord(bytes32 id,uint256 account,uint256 amount) private {
        require(amount<=budgets[id],"BUDGET");
        claimed[id][account]=true;budgets[id]-=amount;unallocatedBudget-=amount;
        credits[account]+=amount;creditedLiability+=amount;
        require(creditedLiability<=unpaidLiability,"LIABILITY");
        emit ResearchFeeClaimed(id,account,amount);
        // unpaidLiability is total unpaid liability, including these credits.
        // No token call or payment occurs during claim; custody is unchanged.
    }

    mapping(uint256=>address) public owners;
    mapping(uint256=>uint256) public epochs;
    event ResearchAccountTransferred(uint256 indexed account,address indexed from,address indexed to,uint256 epoch);
    event ResearchWithdrawal(uint256 indexed account,address indexed recipient,uint256 epoch,uint256 amount);
    modifier guarded() {
        require(entered==0,"REENTRY");entered=1;_;
        require(unpaidLiability==unallocatedBudget+creditedLiability,"TOTAL_LIABILITY");
        require(creditedLiability==credits[2]+credits[3]+credits[4],"CREDIT_SUM");
        require(token.balanceOf(address(this))>=unpaidLiability,"BACKING");
        entered=0;
    }
    function authority(uint256 account,uint256 epoch) private view {
        require(account>=2 && account<=4,"ACCOUNT");
        require(msg.sender==owners[account],"OWNER");
        require(epoch==epochs[account],"EPOCH");
    }
    function transferAccount(uint256 account,uint256 epoch,address to) external guarded {
        authority(account,epoch);require(to!=address(0),"ZERO_OWNER");
        owners[account]=to;epochs[account]=epoch+1;
        emit ResearchAccountTransferred(account,msg.sender,to,epoch+1);
    }
    function withdraw(uint256 account,uint256 epoch,uint256 amount) external guarded {
        authority(account,epoch);require(amount!=0,"AMOUNT");require(credits[account]>=amount,"CREDIT");
        credits[account]-=amount;creditedLiability-=amount;unpaidLiability-=amount;
        uint256 beforeVault=token.balanceOf(address(this));uint256 beforeRecipient=token.balanceOf(msg.sender);
        require(token.transfer(msg.sender,amount),"TOKEN_FALSE");
        require(token.balanceOf(address(this))+amount==beforeVault,"OUTBOUND");
        require(token.balanceOf(msg.sender)==beforeRecipient+amount,"RECIPIENT");
        emit ResearchWithdrawal(account,msg.sender,epoch,amount);
    }
}
