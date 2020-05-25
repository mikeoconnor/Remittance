pragma solidity 0.5.0;

import "./SafeMath.sol";
import "./Stoppable.sol";

contract Remittance is Stoppable {
    using SafeMath for uint;

    struct PaymentStruct {
        address payer;
        uint256 funds;
        uint256 expirationDate;
    }

    mapping(bytes32 => PaymentStruct) payments;
    
    event LogSetup(address indexed sender, address indexed shop, uint256 amount, bytes32 puzzle, uint256 expirationDate);
    event LogClaimFunds(address indexed sender, uint256 amount);
    event LogPayerReclaimsFunds(address indexed sender, uint256 amount);
    
    function setupPuzzleAndFunds(bytes32 _puzzle, address _shop, uint256 _expirationDate) public payable ifAlive ifRunning returns(bool success){
        require(_puzzle != 0, "No puzzle provided");
        require(_shop != address(0), "no shop");
        require(_expirationDate >= now, "expiration date not in future");
        require(msg.value != 0, "No funds provided");
        require(payments[_puzzle].payer == address(0), "puzzle should be zero");
        payments[_puzzle].payer = msg.sender;
        payments[_puzzle].expirationDate = _expirationDate;
        payments[_puzzle].funds = msg.value;
        emit LogSetup(msg.sender, _shop, msg.value, _puzzle, _expirationDate);
        return true;
    }
    
    function solvePuzzleAndClaimFunds(string memory solution2) public payable ifAlive ifRunning returns(bool success){
        bytes32 puzzle = generatePuzzle(msg.sender, solution2);
        uint256 amount = payments[puzzle].funds;
        require(amount != 0, "no funds");
        payments[puzzle].funds = 0;
        payments[puzzle].expirationDate = 0;
        emit LogClaimFunds(msg.sender, amount);
        (success, ) = msg.sender.call.value(amount)("");
        require(success, "Failed to transfer funds");
    }

    function generatePuzzle(address shop, string memory solution2) public view returns (bytes32 newPuzzle) {
        return keccak256(abi.encode(address(this), shop, solution2));
    }

    function payerReclaimFundsAfterExpirationDate(address _shop, string memory solution2) public payable returns (bool success){
        bytes32 puzzle = generatePuzzle(_shop, solution2);
        require(payments[puzzle].payer == msg.sender, "not payer");
        require(now >= payments[puzzle].expirationDate, "not expired");
        uint256 amount = payments[puzzle].funds;
        require(amount != 0, "no funds");
        payments[puzzle].funds = 0;
        payments[puzzle].expirationDate = 0;
        emit LogPayerReclaimsFunds(msg.sender, amount);
        (success, ) = msg.sender.call.value(amount)("");
        require(success, "Failed to transfer funds");
    }
}
