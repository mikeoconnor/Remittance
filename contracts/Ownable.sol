pragma solidity 0.5.0;

contract Ownable {

    address public owner;

    event LogChangeOwner(address sender, address newOwner);

    modifier onlyOwner {
        require(owner == msg.sender, "Not owner");
        _;
    }

    constructor() public {
        owner = msg.sender;
    }

    function changeOwner(address newOwner) public onlyOwner returns(bool success){
        emit LogChangeOwner(msg.sender, newOwner);
        owner = newOwner;
        return true;
    }
}
