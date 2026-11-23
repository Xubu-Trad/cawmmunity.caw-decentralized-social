// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {PaidLikes, IPool, IToken, IRegistry} from "./PaidLikes.sol";

contract PaidReCAWs {
    PaidLikes public immutable source;
    IPool public immutable pool;
    mapping(bytes32 => mapping(bytes32 => bool)) public reposted;
    event ReCAWed(bytes32 indexed post,address indexed payer,address indexed author,string name,uint256 eligible);
    event Credit(address indexed staker,uint256 weight,uint256 amount);

    constructor(PaidLikes verifier) {
        require(block.chainid == 1337,"LOCAL");
        source = verifier;
        pool = verifier.pool();
    }

    function recaw(string calldata name, bytes32 post, address[] calldata members, PaidLikes.Proof calldata proof) external {
        (,address owner) = IRegistry(pool.registry()).lookup(name);
        require(owner == msg.sender,"NFT_OWNER");
        address author = source.authorOf(post);
        if (author == address(0)) {
            require(source.remember(proof) == post,"TARGET");
            author = source.authorOf(post);
        }
        bytes32 identity = keccak256(bytes(name));
        require(author != address(0) && author != msg.sender && !reposted[post][identity],"SELF_OR_REPEAT");
        reposted[post][identity] = true;

        uint256 eligible = pool.totalStake() - pool.stakeOf(msg.sender);
        require(eligible > 0 && members.length <= 32,"NO_POOL");
        IToken token = IToken(pool.token());
        require(token.transferFrom(msg.sender,author,2000 ether),"AUTHOR_PAYMENT");
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
            uint256 next = 2000 ether * cumulative / eligible;
            uint256 share = next - distributed;
            if (share > 0) require(token.transferFrom(msg.sender,recipient,share),"STAKER_PAYMENT");
            emit Credit(recipient,weight,share);
            distributed = next;
        }
        require(cumulative == eligible && distributed == 2000 ether,"INCOMPLETE_POOL");
        emit ReCAWed(post,msg.sender,author,name,eligible);
    }
}
