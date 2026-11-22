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

// Experimental account-bound credits and withdrawals through a separate test registry.
// Five mock base units are an experimental input, not an adopted CAW fee.
interface IRegistryResearch {function authority(uint256 id) external view returns(address,uint256);}
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
    constructor(address token_,address payer_,bytes32 root_,address registry_,bytes32 registryHash_) {
        require(token_.code.length!=0 && payer_!=address(0));
        require(registry_.code.length!=0 && registry_.codehash==registryHash_,"REGISTRY");registry=IRegistryResearch(registry_);registryCodeHash=registryHash_;
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

    // Constructor-only registry fixture. No adopted NFT beneficiary policy.
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
        // No token transfer occurs during claim; the guard checks custody with a view call.
    }

    IRegistryResearch public immutable registry;
    bytes32 public immutable registryCodeHash;
    function current(uint256 id) private view returns(address owner,uint256 epoch) {
        require(address(registry).codehash==registryCodeHash,"REGISTRY_CODE");
        (owner,epoch)=registry.authority(id);require(owner!=address(0),"ZERO_OWNER");
    }
    function owners(uint256 id) external view returns(address owner){(owner,)=current(id);}
    function epochs(uint256 id) external view returns(uint256 epoch){(,epoch)=current(id);}

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
        (address owner,uint256 actualEpoch)=current(account);
        require(msg.sender==owner,"OWNER");require(epoch==actualEpoch,"EPOCH");
    }
    function withdraw(uint256 account,uint256 epoch,uint256 amount) external guarded {
        authority(account,epoch);require(amount!=0,"AMOUNT");require(credits[account]>=amount,"CREDIT");
        credits[account]-=amount;creditedLiability-=amount;unpaidLiability-=amount;
        uint256 beforeVault=token.balanceOf(address(this));uint256 beforeRecipient=token.balanceOf(msg.sender);
        require(token.transfer(msg.sender,amount),"TOKEN_FALSE");
        require(token.balanceOf(address(this))+amount==beforeVault,"OUTBOUND");
        require(token.balanceOf(msg.sender)==beforeRecipient+amount,"RECIPIENT");
        (address finalOwner,uint256 finalEpoch)=current(account);
        require(finalOwner==msg.sender && finalEpoch==epoch,"AUTHORITY_CHANGED");
        emit ResearchWithdrawal(account,msg.sender,epoch,amount);
    }
}



interface ITestAccountReceiver {
    function onERC721Received(address operator, address from, uint256 accountId, bytes calldata data) external returns (bytes4);
}

/// @notice Original ERC721 core fixture for an isolated authority experiment.
/// Constructor creates accounts 1/2 for first and 3 for second. No later mint,
/// burn, admin, metadata, enumeration, registration or username mechanism exists.
/// Account epochs start at zero and increase on EVERY transfer, even to self.
contract TestAccountRegistry {
    mapping(uint256 => address) private owners;
    mapping(address => uint256) private balances;
    mapping(uint256 => address) private approved;
    mapping(address => mapping(address => bool)) private operators;
    mapping(uint256 => uint256) private epochs;

    error InvalidOwner();
    error UnknownAccount();
    error InvalidRecipient();
    error InvalidOperator();
    error NotAuthorized();
    error WrongFrom();
    error UnsafeRecipient();

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);

    constructor(address first, address second) {
        if (first == address(0) || second == address(0)) revert InvalidOwner();
        _initialMint(first, 1);
        _initialMint(first, 2);
        _initialMint(second, 3);
        _initialMint(first, 4); // Derived fixture: explicit zero-weight account; no later mint.
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x01ffc9a7 || interfaceId == 0x80ac58cd;
    }

    function balanceOf(address owner) external view returns (uint256) {
        if (owner == address(0)) revert InvalidOwner();
        return balances[owner];
    }

    function ownerOf(uint256 accountId) public view returns (address owner) {
        owner = owners[accountId];
        if (owner == address(0)) revert UnknownAccount();
    }

    function authority(uint256 accountId) external view returns (address owner, uint256 currentEpoch) {
        owner = ownerOf(accountId);
        currentEpoch = epochs[accountId];
    }

    function epoch(uint256 accountId) external view returns (uint256) {
        ownerOf(accountId);
        return epochs[accountId];
    }

    function getApproved(uint256 accountId) external view returns (address) {
        ownerOf(accountId);
        return approved[accountId];
    }

    function isApprovedForAll(address owner, address operator) external view returns (bool) {
        return operators[owner][operator];
    }

    function approve(address to, uint256 accountId) external {
        address owner = ownerOf(accountId);
        if (msg.sender != owner && !operators[owner][msg.sender]) revert NotAuthorized();
        approved[accountId] = to;
        emit Approval(owner, to, accountId);
    }

    function setApprovalForAll(address operator, bool allowed) external {
        if (operator == msg.sender) revert InvalidOperator();
        operators[msg.sender][operator] = allowed;
        emit ApprovalForAll(msg.sender, operator, allowed);
    }

    function transferFrom(address from, address to, uint256 accountId) external {
        _transfer(from, to, accountId);
    }

    function safeTransferFrom(address from, address to, uint256 accountId) external {
        _safeTransfer(from, to, accountId, "");
    }

    function safeTransferFrom(address from, address to, uint256 accountId, bytes calldata data) external {
        _safeTransfer(from, to, accountId, data);
    }

    function _initialMint(address owner, uint256 accountId) private {
        owners[accountId] = owner;
        balances[owner] += 1;
        emit Transfer(address(0), owner, accountId);
    }

    function _transfer(address from, address to, uint256 accountId) private {
        address owner = ownerOf(accountId);
        if (owner != from) revert WrongFrom();
        if (to == address(0)) revert InvalidRecipient();
        if (msg.sender != owner && msg.sender != approved[accountId] && !operators[owner][msg.sender]) {
            revert NotAuthorized();
        }
        // Approval clearing and epoch movement precede every external callback.
        approved[accountId] = address(0);
        emit Approval(owner, address(0), accountId);
        balances[from] -= 1;
        balances[to] += 1;
        owners[accountId] = to;
        epochs[accountId] += 1;
        emit Transfer(from, to, accountId);
    }

    function _safeTransfer(address from, address to, uint256 accountId, bytes memory data) private {
        _transfer(from, to, accountId);
        if (to.code.length != 0) {
            bytes4 accepted = ITestAccountReceiver(to).onERC721Received(msg.sender, from, accountId, data);
            if (accepted != 0x150b7a02) revert UnsafeRecipient();
        }
        // A compliant receiver may transfer onward during its callback. Do not
        // add a nonstandard final-owner equality check. Rejection reverts all.
    }
}

// Test-only receiver/operator. Unrestricted configuration is not production policy.
contract RegistryHookResearch {
    bool public forward;
    function setForward(bool value) external {forward=value;}
    function cycle(TestAccountRegistry registry,address owner,uint256 id) external {
        registry.transferFrom(owner,address(this),id);
        registry.transferFrom(address(this),owner,id);
    }
    function onERC721Received(address,address from,uint256 id,bytes calldata) external returns(bytes4) {
        if(!forward)return bytes4(0);
        TestAccountRegistry(msg.sender).transferFrom(address(this),from,id);
        return 0x150b7a02;
    }
}

// Deliberately dishonest test registry. Never a production registry candidate.
contract MutableRegistryBoundaryFixture {
    address public reportedOwner;
    uint256 public mode;
    constructor(address owner_) {reportedOwner=owner_;}
    function setOwner(address owner_) external {reportedOwner=owner_;}
    function setMode(uint256 value) external {mode=value;}
    function authority(uint256) external view returns(address,uint256) {
        if(mode==1)return(address(0),0);
        require(mode!=2,"REGISTRY_UNAVAILABLE");
        if(mode==3){assembly {mstore(0,0) return(0,32)}}
        return(reportedOwner,0); // Deliberately never advances epoch.
    }
}
