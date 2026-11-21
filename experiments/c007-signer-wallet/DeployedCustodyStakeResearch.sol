// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

contract MockTokenResearch {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount)
        external returns (bool)
    {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount)
        external returns (bool)
    {
        require(balanceOf[msg.sender] >= amount, "FUNDS");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount)
        external returns (bool)
    {
        require(allowance[from][msg.sender] >= amount, "ALLOWANCE");
        require(balanceOf[from] >= amount, "FUNDS");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

interface IERC20Research {
    function balanceOf(address owner) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount)
        external returns (bool);
}

// Fixed synthetic three-account research; no NFT admission or production policy.


// Constructor-initialized extension of PR #18. No privileged root setter.
// Synthetic accounts and provisional economics remain research-only.
contract DeployedCustodyStakeResearch {
    struct Node { bytes32 hash; uint256 sum; }

    bytes32 public root;
    uint256 public totalStake;
    address public owner2;
    uint256 public epoch2;
    uint256 public credit2;
    uint256 public stake2;
    address public owner3;
    uint256 public epoch3;
    uint256 public credit3;
    uint256 public stake3;
    uint256 public liabilities;
    uint256 private entered;
    address public owner1;
    uint256 public epoch1;
    uint256 public credit1;
    uint256 public stake1;
    mapping(uint256 => uint256) public postNonces;
    uint256 public poolDust;

    event ExperimentalFeeSettled(
        uint256 indexed payerAccount,
        uint256 indexed nonce,
        uint256 allocation2,
        uint256 allocation3,
        uint256 dust,
        bytes32 textHash
    );

    event ExperimentalTextPublished(
        uint256 indexed payerAccount,
        uint256 indexed nonce,
        bytes text
    );

    IERC20Research public immutable TOKEN;

    constructor(address token, address[3] memory owners) {
        require(token.code.length != 0, "TOKEN_CODE");
        require(owners[0] != address(0) && owners[1] != address(0)
            && owners[2] != address(0), "ZERO_OWNER");
        TOKEN = IERC20Research(token);
        owner1 = owners[0]; owner2 = owners[1]; owner3 = owners[2];
        // Present zero-stake accounts 1,2,3; every other leaf absent.
        // Compute the same sparse-tree commitment used by PR #18.
        bytes32 empty = sha256(hex"00");
        bytes32 left = zeroBranch(empty, zeroLeaf(1));
        bytes32 right = zeroBranch(zeroLeaf(2), zeroLeaf(3));
        bytes32 node = zeroBranch(left, right);
        empty = zeroBranch(empty, empty);
        empty = zeroBranch(empty, empty);
        for (uint256 height = 2; height < 256; ++height) {
            node = zeroBranch(node, empty);
            empty = zeroBranch(empty, empty);
        }
        root = sha256(abi.encodePacked(
            "CAW_STAKE_TREE_RESEARCH_V1", bytes1(0), NS, node, uint256(0)
        ));
        // Credit, stake, liabilities, dust, epochs and nonces start at zero.
    }

    function zeroLeaf(uint256 id) private pure returns (bytes32) {
        return sha256(abi.encodePacked(bytes1(0x01), id, uint256(0)));
    }

    function zeroBranch(bytes32 left, bytes32 right) private pure returns (bytes32) {
        return sha256(abi.encodePacked(
            bytes1(0x02), left, uint256(0), right, uint256(0)
        ));
    }

    modifier guarded() {
        require(entered == 0, "REENTRY");
        entered = 1;
        _;
        entered = 0;
    }

    bytes32 private constant NS =
        0x1111111111111111111111111111111111111111111111111111111111111111;


    // EXPERIMENTAL PROFILE; no authorization or settlement here.
    uint256 public constant SIGNED_FEE = 5000 * 10**18;
    bytes32 public constant SIGNED_PROFILE =
        keccak256("CAW_C007_SYNTHETIC_POST_V1");

    bytes32 private constant DOMAIN_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );
    bytes32 private constant NAME_HASH =
        keccak256("CAW C007 Synthetic Action");
    bytes32 private constant VERSION_HASH = keccak256("1");
    bytes32 private constant POST_TYPEHASH = keccak256(
        "Post(uint256 accountId,uint256 epoch,uint256 nonce,uint256 validAfter,uint256 deadline,bytes32 stakeRoot,bytes32 textHash,uint256 fee,bytes32 profile)"
    );

    struct PostIntent {
        uint256 accountId;
        uint256 epoch;
        uint256 nonce;
        uint256 validAfter;
        uint256 deadline;
        bytes32 stakeRoot;
        bytes32 textHash;
    }

    function postDigest(PostIntent calldata req)
        external view returns (bytes32)
    {
        bytes32 domain = keccak256(abi.encode(
            DOMAIN_TYPEHASH, NAME_HASH, VERSION_HASH,
            block.chainid, address(this)
        ));

        bytes32 body = keccak256(abi.encode(
            POST_TYPEHASH, req.accountId, req.epoch,
            req.nonce, req.validAfter, req.deadline,
            req.stakeRoot, req.textHash,
            SIGNED_FEE, SIGNED_PROFILE
        ));

        return keccak256(abi.encodePacked(
            hex"1901", domain, body
        ));
    }


    // Research only: verification does not spend or consume a nonce.
    uint256 private constant EOA_HALF_ORDER =
        0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0;

    // Research only: nonce consumption, not paid settlement.

    // Provisional C-004 research rule, not adopted protocol policy.
    // Count Unicode scalar values, preserve input bytes unchanged.
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

    function settleFixedPool1(
        PostIntent calldata req,
        bytes calldata signature,
        bytes calldata text
    ) external guarded {
        require(req.accountId == 1, "ACCOUNT");
        require(req.nonce == postNonces[req.accountId], "NONCE");
        require(
            req.validAfter < req.deadline &&
            block.timestamp >= req.validAfter &&
            block.timestamp < req.deadline,
            "WINDOW"
        );
        _validateUtf8Text(text);
        require(keccak256(text) == req.textHash, "TEXT_HASH");
        require(this.verifyPost(req, signature), "AUTH");

        // Three fixed synthetic accounts; no scalable settlement claim.
        require(
            credit1 >= stake1 &&
            credit1 - stake1 >= SIGNED_FEE,
            "CREDIT"
        );
        require(
            stake2 <= credit2 && stake3 <= credit3,
            "STAKE_BACKING"
        );

        uint256 eligible = stake2 + stake3;
        require(eligible != 0, "NO_POOL");

        // Checked uint256 arithmetic. Large-product bounds remain open.
        uint256 allocation2 = SIGNED_FEE * stake2 / eligible;
        uint256 allocation3 = SIGNED_FEE * stake3 / eligible;
        uint256 dust = SIGNED_FEE - allocation2 - allocation3;

        require(
            TOKEN.balanceOf(address(this)) >= liabilities + poolDust,
            "BACKING"
        );

        credit1 -= SIGNED_FEE;
        credit2 += allocation2;
        credit3 += allocation3;

        liabilities -= dust;
        poolDust += dust;
        postNonces[req.accountId] = req.nonce + 1;

        require(
            liabilities == credit1 + credit2 + credit3,
            "CREDIT_SUM"
        );
        require(
            TOKEN.balanceOf(address(this)) >= liabilities + poolDust,
            "BACKING"
        );

        emit ExperimentalFeeSettled(
            1, req.nonce, allocation2, allocation3,
            dust, req.textHash
        );
        emit ExperimentalTextPublished(1, req.nonce, text);
    }

    // Research wallet profile: fixed gas/signature bounds are not universal ERC-1271 support.
    function verifyPost(PostIntent calldata req, bytes calldata signature)
        external view returns (bool)
    {
        if (owner1.code.length == 0) return this.verifyPostEOA(req, signature);
        require(req.accountId == 1, "ACCOUNT");
        require(req.epoch == epoch1, "EPOCH");
        require(req.stakeRoot == root, "ROOT");
        require(signature.length <= 4096, "SIGNATURE_LIMIT");
        bytes memory payload = abi.encodeWithSelector(bytes4(0x1626ba7e), this.postDigest(req), signature);
        address wallet = owner1;
        bool accepted; uint256 returned; bytes32 firstWord;
        // Reuse the prior paid-action probe's bounded static-call profile.
        assembly {
            let output := mload(0x40)
            mstore(output, 0)
            accepted := staticcall(100000, wallet, add(payload, 32), mload(payload), output, 32)
            returned := returndatasize()
            firstWord := mload(output)
        }
        require(accepted && returned >= 32 && bytes4(firstWord) == bytes4(0x1626ba7e), "WALLET_SIGNATURE");
        return true;
    }

    function verifyPostEOA(
        PostIntent calldata req,
        bytes calldata signature
    ) external view returns (bool) {
        require(req.accountId == 1, "ACCOUNT");
        require(req.epoch == epoch1, "EPOCH");
        require(req.stakeRoot == root, "ROOT");
        require(owner1 != address(0), "OWNER_UNSET");
        require(owner1.code.length == 0, "OWNER_CODE");
        require(signature.length == 65, "SIG_LEN");

        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }

        require(v == 27 || v == 28, "SIG_V");
        require(
            uint256(s) > 0 && uint256(s) <= EOA_HALF_ORDER,
            "SIG_S"
        );

        address recovered =
            ecrecover(this.postDigest(req), v, r, s);

        require(
            recovered != address(0) && recovered == owner1,
            "SIGNER"
        );
        return true;
    }

    function derive(uint256 id, uint256 amount, Node[256] calldata proof)
        internal pure returns (bytes32, uint256)
    {
        bytes32 h = sha256(abi.encodePacked(bytes1(0x01), id, amount));
        uint256 total = amount;
        for (uint256 i; i < 256; ++i) {
            Node calldata n = proof[i];
            h = (id & 1) == 0
                ? sha256(abi.encodePacked(bytes1(0x02), h, total, n.hash, n.sum))
                : sha256(abi.encodePacked(bytes1(0x02), n.hash, n.sum, h, total));
            total += n.sum;
            id >>= 1;
        }
        return (sha256(abi.encodePacked(
            "CAW_STAKE_TREE_RESEARCH_V1", bytes1(0), NS, h, total
        )), total);
    }

    function changeStake(
        uint256 id, uint256 expectedEpoch, bool increase,
        uint256 amount, bool injectedRevert, Node[256] calldata proof
    ) external guarded returns (bytes32) {
        uint256 oldStake;
        uint256 nextStake;
        {
            address own;
            uint256 ep;
            uint256 credit;

        if (id == 2) {
            (own, ep, oldStake, credit) = (owner2, epoch2, stake2, credit2);
        } else if (id == 3) {
            (own, ep, oldStake, credit) = (owner3, epoch3, stake3, credit3);
        } else if (id == 1) {
            (own, ep, oldStake, credit) =
                (owner1, epoch1, stake1, credit1);
        } else {
            revert("ACCOUNT");
        }

        require(msg.sender == own, "OWNER");
        require(expectedEpoch == ep, "EPOCH");
        require(amount != 0, "AMOUNT");

        if (increase) {
            require(credit >= oldStake && amount <= credit - oldStake, "CREDIT");
            nextStake = oldStake + amount;
        } else {
            require(amount <= oldStake, "STAKE");
            nextStake = oldStake - amount;
        }
        }

        {
            (bytes32 oldRoot, uint256 oldTotal) = derive(id, oldStake, proof);
            require(oldRoot == root && oldTotal == totalStake, "PROOF");
        }

        (bytes32 newRoot, uint256 newTotal) = derive(id, nextStake, proof);
        uint256 predicted = increase ? totalStake + amount : totalStake - amount;
        require(newTotal == predicted, "TOTAL");

        root = newRoot;
        totalStake = newTotal;
        if (id == 2) stake2 = nextStake;
        else if (id == 3) stake3 = nextStake;
        else stake1 = nextStake;

        // Test-only failure injection; not a production function profile.
        if (injectedRevert) revert("INJECTED_REVERT");
        return newRoot;
    }


    function custodyAuthority(uint256 id, uint256 epoch)
        private view
    {
        if (id == 2) {
            require(msg.sender == owner2, "OWNER");
            require(epoch == epoch2, "EPOCH");
        } else if (id == 3) {
            require(msg.sender == owner3, "OWNER");
            require(epoch == epoch3, "EPOCH");
        } else if (id == 1) {
            require(msg.sender == owner1, "OWNER");
            require(epoch == epoch1, "EPOCH");
        } else {
            revert("ACCOUNT");
        }
    }

    function deposit(uint256 id, uint256 epoch, uint256 amount)
        external guarded
    {
        custodyAuthority(id, epoch);
        require(amount != 0, "AMOUNT");

        uint256 beforeBalance = TOKEN.balanceOf(address(this));

        require(
            TOKEN.transferFrom(msg.sender, address(this), amount),
            "TOKEN"
        );
        require(
            TOKEN.balanceOf(address(this)) == beforeBalance + amount,
            "INBOUND"
        );

        if (id == 2) credit2 += amount;
        else if (id == 3) credit3 += amount;
        else credit1 += amount;

        liabilities += amount;

        require(liabilities == credit1 + credit2 + credit3, "CREDIT_SUM");
        require(TOKEN.balanceOf(address(this)) >= liabilities, "BACKING");
    }

    function withdraw(uint256 id, uint256 epoch, uint256 amount)
        external guarded
    {
        custodyAuthority(id, epoch);
        require(amount != 0, "AMOUNT");

        if (id == 2) {
            require(credit2 >= stake2, "LOCKED");
            require(amount <= credit2 - stake2, "AVAILABLE_CREDIT");
            credit2 -= amount;
        } else if (id == 3) {
            require(credit3 >= stake3, "LOCKED");
            require(amount <= credit3 - stake3, "AVAILABLE_CREDIT");
            credit3 -= amount;
        } else {
            require(credit1 >= stake1, "LOCKED");
            require(amount <= credit1 - stake1, "AVAILABLE_CREDIT");
            credit1 -= amount;
        }

        liabilities -= amount;

        uint256 vaultBefore = TOKEN.balanceOf(address(this));
        uint256 walletBefore = TOKEN.balanceOf(msg.sender);
        require(vaultBefore >= amount, "VAULT");

        require(TOKEN.transfer(msg.sender, amount), "TOKEN");
        require(
            TOKEN.balanceOf(address(this)) + amount == vaultBefore,
            "OUTBOUND"
        );
        require(
            TOKEN.balanceOf(msg.sender) == walletBefore + amount,
            "RECIPIENT"
        );
        require(liabilities == credit1 + credit2 + credit3, "CREDIT_SUM");
        require(TOKEN.balanceOf(address(this)) >= liabilities, "BACKING");
    }

    function transferAccount(uint256 id, uint256 expectedEpoch, address to)
        external guarded
    {
        require(to != address(0), "ZERO_OWNER");
        if (id == 2) {
            require(msg.sender == owner2, "OWNER");
            require(expectedEpoch == epoch2, "EPOCH");
            owner2 = to;
            epoch2 += 1;
        } else if (id == 3) {
            require(msg.sender == owner3, "OWNER");
            require(expectedEpoch == epoch3, "EPOCH");
            owner3 = to;
            epoch3 += 1;
        } else if (id == 1) {
            require(msg.sender == owner1, "OWNER");
            require(expectedEpoch == epoch1, "EPOCH");
            owner1 = to;
            epoch1 += 1;
        } else revert("ACCOUNT");
    }
}

