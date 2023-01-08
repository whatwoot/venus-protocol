pragma solidity ^0.5.16;

import "./BEP20.sol";
import "hardhat/console.sol";
contract MockToken is StandardToken {

    constructor(
        string memory _tokenName,      
        string memory _tokenSymbol,
        uint8 _decimalUnits
        ) public StandardToken(1e27, _tokenName,_decimalUnits,_tokenSymbol) {
            console.log("Mock..............");
    }

    function mint(address recipient, uint256 amount) external {
        require(amount != 0, "amount == 0");
        totalSupply = totalSupply.add(amount);
        balanceOf[msg.sender] = balanceOf[msg.sender].add(amount);
        emit Transfer(address(0), msg.sender, amount);
    }
}