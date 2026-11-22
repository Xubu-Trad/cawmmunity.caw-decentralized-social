// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// Manifesto recommended username schedule, denominated in raw CAW units.
contract UsernameTerms {
    error InvalidName();

    function quote(string memory name) public pure returns (uint256) {
        bytes memory text = bytes(name);
        if (text.length == 0) revert InvalidName();
        for (uint256 i; i < text.length; ++i) {
            uint8 c = uint8(text[i]);
            if (!((c >= 97 && c <= 122) || (c >= 48 && c <= 57))) revert InvalidName();
        }
        uint256[8] memory tiers = [uint256(1_000_000_000_000), 240_000_000_000, 60_000_000_000,
            6_000_000_000, 200_000_000, 20_000_000, 10_000_000, 1_000_000];
        return tiers[text.length >= 8 ? 7 : text.length - 1] * 1 ether;
    }
}
