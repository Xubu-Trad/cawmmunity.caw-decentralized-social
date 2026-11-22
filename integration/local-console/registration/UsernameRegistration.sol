// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {UsernameTerms} from "../UsernameTerms.sol";

/// Review candidate for the historical sink option in the C001 decision packet.
contract UsernameRegistration is ERC721, UsernameTerms, ReentrancyGuard {
    address public constant SINK = 0xdEAD000000000000000042069420694206942069;
    IERC20 public immutable paymentToken;
    mapping(uint256 => string) public usernameOf;

    error InvalidPaymentToken();
    error Unavailable();
    error PaymentMismatch();

    constructor(address token) ERC721("CAW Username Candidate", "CAWNAME") {
        if (token.code.length == 0) revert InvalidPaymentToken();
        paymentToken = IERC20(token);
    }

    function register(string calldata name) external nonReentrant returns (uint256 id) {
        uint256 price = quote(name);
        id = uint256(keccak256(bytes(name)));
        if (_ownerOf(id) != address(0)) revert Unavailable();
        uint256 beforeSink = paymentToken.balanceOf(SINK);
        uint256 beforePayer = paymentToken.balanceOf(msg.sender);
        if (!paymentToken.transferFrom(msg.sender, SINK, price)
            || paymentToken.balanceOf(SINK) != beforeSink + price
            || paymentToken.balanceOf(msg.sender) + price != beforePayer) revert PaymentMismatch();
        usernameOf[id] = name;
        _safeMint(msg.sender, id);
    }
}
