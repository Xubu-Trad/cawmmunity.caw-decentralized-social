// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {UsernameRegistration} from "./UsernameRegistration.sol";

/// Historical-sink candidate for review. The community still needs to decide C-001.
contract CawUsernameRegistration is UsernameRegistration {
    bytes32 public constant CAW_RUNTIME = 0x6ee560d3e6b1f881a8711e0be0b30a0e8e0cf8b915ce8f75ea05002126c94256;
    address public constant ETHEREUM_CAW = 0xf3b9569F82B18aEf890De263B84189bd33EBe452;

    constructor(address token) UsernameRegistration(token) {
        if (token.codehash != CAW_RUNTIME || (block.chainid == 1 && token != ETHEREUM_CAW)) {
            revert InvalidPaymentToken();
        }
    }
}
