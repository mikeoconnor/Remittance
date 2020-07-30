pragma solidity 0.5.0;

import "./SafeMath.sol";
import "./Stoppable.sol";
import "./provableAPI.sol";

contract Remittance is usingProvable, Stoppable {
    using SafeMath for uint;

    struct PaymentStruct {
        address payer;
        uint256 funds;
        uint256 expirationDate;
        uint256 amountUsCents;
    }

    struct ShopStruct {
        bytes32 puzzle;
        address shop;
    }

    mapping(bytes32 => PaymentStruct) payments;

    mapping(bytes32 => ShopStruct) provableIds;
    
    event LogSetup(address indexed sender, address indexed shop, uint256 amount, bytes32 indexed puzzle, uint256 expirationDate, uint256 amountUsCents);
    event LogClaimFunds(address indexed sender, uint256 amount, bytes32 indexed puzzle);
    event LogPayerReclaimsFunds(address indexed sender, uint256 amount, bytes32 indexed puzzle);
    event LogPriceEthUsCent(uint256 indexed ethUsCent);
    event LogQuery(address indexed sender, bytes32 id, uint256 queryPrice, bytes32 indexed puzzle);
    
    function setupPuzzleAndFunds(bytes32 _puzzle, address _shop, uint256 _expirationDate, uint256 _amountUsCents) public payable ifAlive ifRunning returns(bool success){
        require(_puzzle != 0, "No puzzle provided");
        require(_shop != address(0), "no shop");
        require(_expirationDate >= now, "expiration date not in future");
        require(msg.value != 0, "No funds provided");
        require(payments[_puzzle].payer == address(0), "puzzle should not be set");
        payments[_puzzle].payer = msg.sender;
        payments[_puzzle].expirationDate = _expirationDate;
        payments[_puzzle].funds = msg.value;
        payments[_puzzle].amountUsCents = _amountUsCents;
        emit LogSetup(msg.sender, _shop, msg.value, _puzzle, _expirationDate, _amountUsCents);
        return true;
    }
    
    function solvePuzzleAndClaimFunds(bytes32 solution) public payable ifAlive ifRunning returns(bool success){
        bytes32 puzzle = generatePuzzle(msg.sender, solution);
        uint256 amount = payments[puzzle].funds;
        require(payments[puzzle].amountUsCents != 0, "puzzle not set");

        provable_setCustomGasPrice(21 * 10 ** 9);
        uint256 queryPrice = provable_getPrice("URL");
        require(amount >= queryPrice, "insufficient funds to query provable");
        payments[puzzle].funds = payments[puzzle].funds.sub(queryPrice);

        bytes32 id = provable_query("URL", "json(https://api.kraken.com/0/public/Ticker?pair=ETHUSD).result.XETHZUSD.c.0");
        provableIds[id].puzzle = puzzle;
        provableIds[id].shop = msg.sender;
        emit LogQuery(msg.sender, id, queryPrice, puzzle);
        return true;
    }

    function generatePuzzle(address shop, bytes32 solution) public view returns (bytes32 newPuzzle) {
        return keccak256(abi.encode(address(this), shop, solution));
    }

    function payerReclaimFunds(address _shop, bytes32 solution) public payable returns (bool success){
        bytes32 puzzle = generatePuzzle(_shop, solution);
        require(payments[puzzle].payer == msg.sender, "not payer");
        require(now >= payments[puzzle].expirationDate, "not expired");
        uint256 amount = payments[puzzle].funds;
        require(amount != 0, "no funds");
        payments[puzzle].funds = 0;
        payments[puzzle].expirationDate = 0;
        payments[puzzle].amountUsCents = 0;
        emit LogPayerReclaimsFunds(msg.sender, amount, puzzle);
        (success, ) = msg.sender.call.value(amount)("");
        require(success, "Failed to transfer funds");
    }

    function __callback(bytes32 _myId, string memory _result) public ifAlive ifRunning {
        require(msg.sender == provable_cbAddress(), "calling address does not match usingProvable contract address");
        require(provableIds[_myId].puzzle != 0, "provable query id does not match");

        bytes32 puzzle = provableIds[_myId].puzzle;
        address shop = provableIds[_myId].shop;
        provableIds[_myId].puzzle = 0;
        provableIds[_myId].shop = address(0);
        uint256 ethUsCent = parseInt(_result,2);
        emit LogPriceEthUsCent(ethUsCent);
        sendFundsToShop(shop, puzzle, ethUsCent);
    }

    function sendFundsToShop(address shop, bytes32 puzzle, uint256 ethUsCent) internal returns (bool success) {
        uint256 amountToSend = payments[puzzle].amountUsCents.mul(1 ether).div(ethUsCent);
        require(payments[puzzle].funds >= amountToSend, "insufficent funds to convert to USD");

        payments[puzzle].funds = payments[puzzle].funds.sub(amountToSend);
        payments[puzzle].expirationDate = 0;
        payments[puzzle].amountUsCents = 0;

        emit LogClaimFunds(shop, amountToSend, puzzle);
        (success, ) = shop.call.value(amountToSend)("");
        require(success, "Failed to transfer funds");
    }
}
