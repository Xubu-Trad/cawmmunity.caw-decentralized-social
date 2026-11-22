// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
// Unrestricted fault injection for local tests only; never a production token.
contract FailureTokenFixture {
 mapping(address=>uint256) public rawBalance;
 mapping(address=>mapping(address=>uint256)) public allowance;
 mapping(address=>uint256) public reportedBalance;
 uint256 public mode;
 bool public touched;
 function balanceOf(address who) external view returns(uint256){
  require(mode!=9 && !(mode==11 && touched),"BALANCE_REVERT");
  if(mode==10) assembly { mstore(0,1) return(0,31) }
  if(mode==12) assembly { for {} 1 {} {} }
  return mode==14 ? reportedBalance[who] : rawBalance[who];
 }
 function setMode(uint256 value) external { mode=value; touched=false; }
 function mint(address to,uint256 amount) external { rawBalance[to]+=amount; reportedBalance[to]+=amount; }
 function approve(address to,uint256 amount) external returns(bool){allowance[msg.sender][to]=amount;return true;}
 function transfer(address to,uint256 amount) external returns(bool){return move(msg.sender,to,amount,false);}
 function transferFrom(address from,address to,uint256 amount) external returns(bool){return move(from,to,amount,true);}
 function move(address from,address to,uint256 amount,bool useAllowance) internal returns(bool){
  if(mode==14){
   if(useAllowance){require(allowance[from][msg.sender]>=amount,"ALLOWANCE");allowance[from][msg.sender]-=amount;}
   require(reportedBalance[from]>=amount,"REPORTED_FUNDS");reportedBalance[from]-=amount;reportedBalance[to]+=amount;return true;
  }
  if(mode==1)return false;
  require(mode!=2,"TOKEN_REVERT");
  if(mode==4)return true;
  if(useAllowance){require(allowance[from][msg.sender]>=amount,"ALLOWANCE");allowance[from][msg.sender]-=amount;}
  require(rawBalance[from]>=amount,"FUNDS");rawBalance[from]-=amount;
  rawBalance[to]+= mode==5 ? amount-1 : amount;
  reportedBalance[from]=rawBalance[from];reportedBalance[to]=rawBalance[to];
  touched=true;
  if(mode==13) assembly { for {} 1 {} {} }
  if(mode==6) assembly { return(0,0) }
  if(mode==7) assembly { mstore(0,1) return(0,31) }
  if(mode==8) assembly { mstore(0,2) return(0,32) }
  if(mode==3)return false;
  return true;
 }
}
