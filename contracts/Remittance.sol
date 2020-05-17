pragma solidity 0.5.0;

import "./SafeMath.sol";
import "./Stoppable.sol";

contract Remittance is Stoppable {
    using SafeMath for uint;

    bytes32 private puzzle;
    uint256 funds;
    address payer;
    uint256 public expirationDate;
    
    event LogSetup(address indexed sender, uint256 amount, bytes32 puzzle, uint256 expirationDate);
    event LogClaimFunds(address indexed sender, uint256 amount);
    event LogPayerReclaimsFunds(address indexed sender, uint256 amount);
    
    function setupPuzzleAndFunds(bytes32 _puzzle, uint256 _expirationDate) public payable ifAlive ifRunning returns(bool success){
        require(_puzzle != 0, "No puzzle provided");
        require(_expirationDate >= now, "expiration date not in future");
        require(puzzle == 0, "puzzle should be zero");
        require(msg.value != 0, "No funds provided");
        puzzle = _puzzle;
        payer = msg.sender;
        expirationDate = _expirationDate;
        funds = funds.add(msg.value);
        emit LogSetup(msg.sender, msg.value, _puzzle, _expirationDate);
        return true;
    }
    
    function solvePuzzleAndClaimFunds(string memory solution1, string memory solution2) public payable ifAlive ifRunning returns(bool success){
        require(puzzle != 0, "no puzzle");
        require(funds != 0, "no funds");
        require(puzzle == generatePuzzle(solution1, solution2), "Puzzle not solved");
        uint256 amount = funds;
        funds = 0;
        emit LogClaimFunds(msg.sender, amount);
        (bool result, ) = msg.sender.call.value(amount)("");
        require(result, "Failed to transfer funds");
        return result;
    }

    function generatePuzzle(string memory solution1, string memory solution2) public view returns (bytes32 newPuzzle) {
        return keccak256(abi.encode(address(this), solution1, solution2));
    }

    function payerReclaimFundsAfterExpirationDate(string memory solution1, string memory solution2) public payable returns (bool success){
        require(puzzle == generatePuzzle(solution1, solution2), "Puzzle not solved");
        require(payer == msg.sender, "not payer");
        require(now >= expirationDate, "not expired");
        require(funds != 0, "no funds");
        uint256 amount = funds;
        funds = 0;
        emit LogPayerReclaimsFunds(msg.sender, amount);
        (bool result, ) = msg.sender.call.value(amount)("");
        require(result, "Failed to transfer funds");
        return result;
    }
}
