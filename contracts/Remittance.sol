pragma solidity 0.5.0;

import "./SafeMath.sol";

contract Remittance {
    using SafeMath for uint;

    enum State { Initial, Ready, Closed }
    bytes32 private puzzle;
    State public state;
    uint256 funds;
    
    event LogSetup(address sender, uint256 amount, bytes32 puzzle);
    event LogClaimFunds(address sender, uint256 amount);
    
    function setupPuzzleAndFunds(bytes32 _puzzle) public payable returns(bool success){
        require(state == State.Initial, "Contract not in Initial state");
        state = State.Ready;
        puzzle = _puzzle;
        funds = funds.add(msg.value);
        emit LogSetup(msg.sender, msg.value, _puzzle);
        return true;
    }
    
    function solvePuzzleAndClaimFunds(string memory solution1, string memory solution2) public payable returns(bool success){
        require(state == State.Ready, "Contract not in Ready state");
        require(puzzle == keccak256(abi.encode(solution1, solution2)), "Puzzle not solved");
        state = State.Closed;
        uint256 amount = funds;
        funds = 0;
        emit LogClaimFunds(msg.sender, amount);
        (bool result, ) = msg.sender.call.value(amount)("");
        require(result, "Failed to transfer funds");
        return result;
    }
}
