// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

interface INameRegistry {
    function lookup(string calldata name) external view returns (uint256, address);
    function paymentToken() external view returns (address);
}
interface IFixtureToken {
    function transfer(address to,uint256 amount) external returns(bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// Disposable registry integration. Bounded local staking pool with direct token payouts.
contract StakedNamePosts {
    INameRegistry public immutable registry;
    IFixtureToken public immutable token;
    uint256 public constant FEE = 5000 ether;
    event Published(uint256 indexed tokenId, address indexed author, string name, string body, uint256 fee);

    // Small enumerable pool for the disposable deployment.
    address[] private members;
    mapping(address => uint256) public stakeOf;
    uint256 public totalStake;
    event StakerPaid(address indexed staker,uint256 weight,uint256 amount);
    event PoolSettled(uint256 eligibleWeight,uint256 recipients);
    function stake(uint256 amount) external {
        require(amount > 0 && amount <= type(uint128).max - totalStake, "AMOUNT");
        if(stakeOf[msg.sender]==0){
            require(members.length < 32, "POOL_FULL");
            members.push(msg.sender);
        }
        stakeOf[msg.sender]+=amount;
        totalStake+=amount;
        require(token.transferFrom(msg.sender,address(this),amount), "STAKE");
    }
    function unstake() external {
        uint256 amount=stakeOf[msg.sender];
        require(amount>0,"NO_STAKE");
        delete stakeOf[msg.sender];
        totalStake-=amount;
        for(uint256 i=0;i<members.length;i++){
            if(members[i]==msg.sender){
                members[i]=members[members.length-1];
                members.pop();
                break;
            }
        }
        require(token.transfer(msg.sender,amount),"UNSTAKE");
    }

    constructor(address registryAddress) {
        require(block.chainid == 1337, "LOCAL");
        registry = INameRegistry(registryAddress);
        token = IFixtureToken(registry.paymentToken());
    }

    function publish(string calldata name, string calldata body) external {
        (, address owner) = registry.lookup(name);
        require(owner == msg.sender, "NFT_OWNER");
        _validateUtf8Text(bytes(body));
        require(token.transferFrom(msg.sender, address(this), FEE), "FEE");
        uint256 eligible=totalStake-stakeOf[msg.sender];
        require(eligible>0,"NO_OTHER_STAKE");
        uint256 cumulative;
        uint256 paid;
        uint256 count;
        for(uint256 i=0;i<members.length;i++){
            address recipient=members[i];
            if(recipient==msg.sender)continue;
            uint256 weight=stakeOf[recipient];
            cumulative+=weight;
            uint256 next=FEE*cumulative/eligible;
            uint256 share=next-paid;
            if(share>0)require(token.transfer(recipient,share),"PAYOUT");
            emit StakerPaid(recipient,weight,share);
            paid=next;
            count++;
        }
        assert(cumulative==eligible && paid==FEE);
        emit PoolSettled(eligible,count);
        emit Published(uint256(keccak256(bytes(name))), msg.sender, name, body, FEE);
    }

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
