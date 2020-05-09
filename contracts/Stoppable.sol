pragma solidity 0.5.0;

import "./Ownable.sol";

contract Stoppable is Ownable {
    bool public isRunning = true;

    event LogStopped(address sender);
    event LogResumed(address sender);

    modifier ifRunning {
        require(isRunning);
        _;
    }

    modifier ifStopped {
        require(!isRunning);
        _;
    }

    function stop() public onlyOwner ifRunning returns(bool success){
        isRunning = false;
        emit LogStopped(msg.sender);
        return true;
    }

    function resume() public onlyOwner ifStopped returns(bool success){
        isRunning = true;
        emit LogResumed(msg.sender);
        return true;
    }
}

