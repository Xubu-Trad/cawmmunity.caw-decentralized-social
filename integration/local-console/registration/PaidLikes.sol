// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

interface IPool {
    function registry() external view returns(address);
    function token() external view returns(address);
    function totalStake() external view returns(uint256);
    function stakeOf(address) external view returns(uint256);
}
interface IRegistry { function lookup(string calldata name) external view returns(uint256,address); }
interface IToken { function transferFrom(address,address,uint256) external returns(bool); }

contract PaidLikes {
    IPool public immutable pool;
    mapping(bytes32 => address) public authorOf;
    mapping(bytes32 => mapping(bytes32 => bool)) public liked;
    event Liked(bytes32 indexed post,address indexed payer,address indexed author,string name,uint256 eligible);
    event Credit(address indexed staker,uint256 weight,uint256 amount);
    constructor(address posts) { require(block.chainid==1337); pool=IPool(posts); }

    // Only inspect canonical RLP after its root has matched a native block hash.
    function item(bytes calldata b,uint i) private pure returns(uint start,uint end) {
        uint tag=uint8(b[i]);
        if(tag<128)return (i,i+1);
        uint base=tag<192?128:192;
        uint n=tag-base;
        if(n<=55)return (i+1,i+1+n);
        uint width=n-55;
        uint len;
        for(uint j=0;j<width;j++)len=len*256+uint8(b[i+1+j]);
        start=i+1+width; end=start+len;
        require(end<=b.length);
    }
    function prefix(uint len,uint base) private pure returns(bytes memory) {
        if(len<56)return abi.encodePacked(uint8(base+len));
        require(len<=65535);
        if(len<256)return abi.encodePacked(uint8(base+56),uint8(len));
        return abi.encodePacked(uint8(base+57),uint16(len));
    }
    function leaf(bytes calldata raw) private pure returns(bytes32){
        bytes memory payload=bytes.concat(hex"822080",prefix(raw.length,128),raw);
        return keccak256(bytes.concat(prefix(payload.length,192),payload));
    }
    struct Proof {uint height;bytes header;bytes txBytes;bytes receipt;}
    function remember(Proof calldata p) public returns(bytes32 hash){
        bytes32 anchor=blockhash(p.height);
        require(anchor!=0 && keccak256(p.header)==anchor,"HEADER");
        (uint pos,)=item(p.header,0);
        for(uint i=0;i<4;i++) (,pos)=item(p.header,pos);
        (uint start,uint end)=item(p.header,pos);
        require(leaf(p.txBytes)==bytes32(p.header[start:end]),"TX_ROOT");
        (start,end)=item(p.header,end);
        require(leaf(p.receipt)==bytes32(p.header[start:end]),"RECEIPT_ROOT");
        bytes calldata b=p.receipt;
        (pos,)=item(b,uint8(b[0])<128?1:0);
        require(b[pos]==0x01,"REVERTED");
        for(uint i=0;i<3;i++) (,pos)=item(b,pos);
        (pos,end)=item(b,pos);
        uint last;
        while(pos<end){last=pos;(,pos)=item(b,pos);}
        (pos,)=item(b,last);
        (start,pos)=item(b,pos);
        require(address(bytes20(b[start:pos]))==address(pool),"POST_CONTRACT");
        (pos,)=item(b,pos);
        (start,pos)=item(b,pos);
        require(bytes32(b[start:pos])==keccak256("Published(uint256,address,string,string,uint256)"),"POST_EVENT");
        (,pos)=item(b,pos);
        (start,pos)=item(b,pos);
        hash=keccak256(p.txBytes);
        authorOf[hash]=address(uint160(uint256(bytes32(b[start:pos]))));
    }
    function like(string calldata name,bytes32 post,address[] calldata members,Proof calldata proof) external {
        (,address owner)=IRegistry(pool.registry()).lookup(name);
        require(owner==msg.sender,"NFT_OWNER");
        if(authorOf[post]==address(0))require(remember(proof)==post,"TARGET");
        address author=authorOf[post];
        bytes32 identity=keccak256(bytes(name));
        require(author!=msg.sender && !liked[post][identity],"SELF_OR_REPEAT");
        liked[post][identity]=true;
        uint eligible=pool.totalStake()-pool.stakeOf(msg.sender);
        require(eligible>0 && members.length<=32,"NO_POOL");
        IToken token=IToken(pool.token());
        require(token.transferFrom(msg.sender,author,1600 ether));
        uint cumulative; uint paid; address previous;
        for(uint i=0;i<members.length;i++){
            address staker=members[i];
            require(staker>previous && staker!=msg.sender,"MEMBERS");
            previous=staker;
            uint weight=pool.stakeOf(staker);
            require(weight!=0);
            cumulative+=weight;
            uint next=400 ether*cumulative/eligible;
            uint share=next-paid;
            if(share!=0)require(token.transferFrom(msg.sender,staker,share));
            emit Credit(staker,weight,share); paid=next;
        }
        require(cumulative==eligible && paid==400 ether,"INCOMPLETE_POOL");
        emit Liked(post,msg.sender,author,name,eligible);
    }
}
