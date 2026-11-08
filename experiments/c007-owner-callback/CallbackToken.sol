// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
interface ICustodyFixture {
    function deposit(uint256,uint256,uint256) external;
    function withdraw(uint256,uint256,uint256) external;
    function transferAccount(uint256,uint256,address) external;
}
// Test-only token doubles as a contract account owner. No production token claim.
contract CallbackToken {
    mapping(address=>uint256) public balanceOf;
    address public vault;
    address public recipient;
    bool public armed;
    bool public callbackAccepted;
    bytes public callbackResult;
    constructor(){balanceOf[address(this)]=1000;}
    function configure(address v,address r,bool a) external {vault=v;recipient=r;armed=a;}
    function attempt() internal {
        if(armed){
            (callbackAccepted,callbackResult)=vault.call(abi.encodeCall(ICustodyFixture.transferAccount,(2,0,recipient)));
        }
    }
    function transferFrom(address from,address to,uint256 amount) external returns(bool){
        require(msg.sender==vault && from==address(this));
        balanceOf[from]-=amount;balanceOf[to]+=amount;attempt();return true;
    }
    function transfer(address to,uint256 amount) external returns(bool){
        require(msg.sender==vault);balanceOf[msg.sender]-=amount;balanceOf[to]+=amount;attempt();return true;
    }
    function deposit() external {ICustodyFixture(vault).deposit(2,0,100);}
    function withdraw() external {ICustodyFixture(vault).withdraw(2,0,10);}
    function transferOutside() external {ICustodyFixture(vault).transferAccount(2,0,recipient);}
}
