// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {IPool, IToken, IRegistry} from "./PaidLikes.sol";

contract PaidFollows {
    IPool public immutable pool;
    mapping(bytes32 => mapping(bytes32 => bool)) public following;
    event Followed(string name,string target,address indexed payer,address indexed recipient,uint256 eligible);
    event Credit(address indexed staker,uint256 weight,uint256 amount);

    constructor(IPool stakingPool) {
        require(block.chainid == 1337,"LOCAL");
        pool = stakingPool;
    }

    function follow(string calldata name, string calldata target, address reviewedOwner, address[] calldata members) external {
        IRegistry registry = IRegistry(pool.registry());
        (,address owner) = registry.lookup(name);
        require(owner == msg.sender,"NFT_OWNER");
        (,address recipient) = registry.lookup(target);
        require(recipient != address(0) && recipient == reviewedOwner,"TARGET_OWNER_CHANGED");
        bytes32 sourceId = keccak256(bytes(name));
        bytes32 targetId = keccak256(bytes(target));
        require(recipient != msg.sender && !following[sourceId][targetId],"SELF_OR_REPEAT");
        following[sourceId][targetId] = true;

        uint256 eligible = pool.totalStake() - pool.stakeOf(msg.sender);
        require(eligible > 0 && members.length <= 32,"NO_POOL");
        IToken token = IToken(pool.token());
        require(token.transferFrom(msg.sender,recipient,24000 ether),"ACCOUNT_PAYMENT");
        uint256 cumulative;
        uint256 distributed;
        address previous;
        for (uint256 i=0; i<members.length; i++) {
            address recipient = members[i];
            require(recipient > previous && recipient != msg.sender,"MEMBERS");
            previous = recipient;
            uint256 weight = pool.stakeOf(recipient);
            require(weight > 0,"EMPTY_STAKE");
            cumulative += weight;
            uint256 next = 6000 ether * cumulative / eligible;
            uint256 share = next - distributed;
            if (share > 0) require(token.transferFrom(msg.sender,recipient,share),"STAKER_PAYMENT");
            emit Credit(recipient,weight,share);
            distributed = next;
        }
        require(cumulative == eligible && distributed == 6000 ether,"INCOMPLETE_POOL");
        emit Followed(name,target,msg.sender,recipient,eligible);
    }
}
