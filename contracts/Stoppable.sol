pragma solidity 0.5.0;

import "./Ownable.sol";

contract Stoppable is Ownable {
    bool private running = true;

    event LogStopped(address sender);
    event LogResumed(address sender);

    modifier ifRunning {
        require(running, "contract not running");
        _;
    }

    modifier ifStopped {
        require(!running, "contract not stopped");
        _;
    }

    function stop() public onlyOwner ifRunning returns(bool success){
        running = false;
        emit LogStopped(msg.sender);
        return true;
    }

    function resume() public onlyOwner ifStopped returns(bool success){
        running = true;
        emit LogResumed(msg.sender);
        return true;
    }

    function isRunning() public view returns(bool){
        return running;
    }
}

