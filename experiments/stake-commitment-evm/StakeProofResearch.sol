// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// Research only: supplied-root equality, never root authentication/admission.
/// No state, custody, update authority, signatures or settlement.
contract StakeProofResearch {
    struct Node { bytes32 hash; uint256 sum; }
    function verify(
        bytes32 namespace, bytes32 expectedRoot, uint256 expectedTotal,
        uint256 account, uint256 stake, bool present, Node[256] calldata siblings
    ) external pure returns (bool) {
        require(present || stake == 0, "ABSENT_STAKE");
        bytes32 current = present
            ? sha256(abi.encodePacked(bytes1(0x01), account, stake))
            : sha256(hex"00");
        uint256 total = stake;
        uint256 index = account;
        for (uint256 height; height < 256; ++height) {
            Node calldata sibling = siblings[height];
            current = (index & 1) == 0
                ? sha256(abi.encodePacked(bytes1(0x02), current, total, sibling.hash, sibling.sum))
                : sha256(abi.encodePacked(bytes1(0x02), sibling.hash, sibling.sum, current, total));
            total += sibling.sum; // checked uint256, overflow reverts
            index >>= 1;
        }
        require(total == expectedTotal, "TOTAL");
        require(sha256(abi.encodePacked(
            "CAW_STAKE_TREE_RESEARCH_V1", bytes1(0), namespace, current, total
        )) == expectedRoot, "ROOT");
        return true;
    }
}
