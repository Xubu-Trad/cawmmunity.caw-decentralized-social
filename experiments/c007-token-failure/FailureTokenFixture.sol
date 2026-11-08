// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
// Unrestricted fault injection for local tests only; never a production token.
contract FailureTokenFixture {
 mapping(address=>uint256) public balanceOf;
 mapping(address=>mapping(address=>uint256)) public allowance;
 uint256 public mode;
 function setMode(uint256 value) external { mode=value; }
 function mint(address to,uint256 amount) external { balanceOf[to]+=amount; }
 function approve(address to,uint256 amount) external returns(bool){allowance[msg.sender][to]=amount;return true;}
 function transfer(address to,uint256 amount) external returns(bool){return move(msg.sender,to,amount,false);}
 function transferFrom(address from,address to,uint256 amount) external returns(bool){return move(from,to,amount,true);}
 function move(address from,address to,uint256 amount,bool useAllowance) internal returns(bool){
  if(mode==1)return false;
  require(mode!=2,"TOKEN_REVERT");
  if(mode==4)return true;
  if(useAllowance){require(allowance[from][msg.sender]>=amount,"ALLOWANCE");allowance[from][msg.sender]-=amount;}
  require(balanceOf[from]>=amount,"FUNDS");balanceOf[from]-=amount;
  balanceOf[to]+= mode==5 ? amount-1 : amount;
  if(mode==3)return false;
  return true;
 }
}
