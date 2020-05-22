const Web3 = require("web3");
const truffleContract = require("truffle-contract");
const $ = require("jquery");

const remittanceJson = require("../../build/contracts/Remittance.json");

if (typeof web3 !== 'undefined') {
    window.web3 = new Web3(web3.currentProvider);
} else {
    window.web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));
}

const Remittance = truffleContract(remittanceJson);
Remittance.setProvider(web3.currentProvider);

window.addEventListener('load', async() => {
    try {
        const accounts = await web3.eth.getAccounts();
        window.owner = accounts[0];
        window.alice = accounts[1];
        window.carol = accounts[2];

        console.log("Owner", window.owner);
        console.log("Alice", window.alice);
        console.log("Carol", window.carol);

        const network = await web3.eth.net.getId();
        console.log("Network", network.toString(10));

        const inst = await Remittance.deployed();
        console.log("Contract Address", inst.address);
        $("#status").html("Status: OK.");

        $("#send").click(setup);
    } catch (e) {
        console.log("error", e);
        $("#status").html("Status: " + e.toString());
    }
});

const setup = async () => {
    try {

        console.log("shop: ", $("input[name='shop']").val());
        console.log("password ", $("input[name='password']").val());

        const inst = await Remittance.deployed();
        const puzzle = await inst.generatePuzzle($("input[name='shop']").val(), $("input[name='password']").val());
        console.log("puzzle ", puzzle);

        //Expiration date is hard fixed to be 30 days from now.
        const DAYS30 = 30*86400;
        const expiration = Math.floor(Date.now() / 1000) + DAYS30;
        console.log("Expiration date ", expiration);
        console.log("Amount: ", $("input[name='amount']").val());
        console.log("Payer ", $("input[name='payer']").val());

        try{
            await inst.setupPuzzleAndFunds.call(
                puzzle,
                $("input[name='shop']").val(),
                expiration,
                {from: $("input[name='payer']").val(), value: $("input[name='amount']").val()
            });
        } catch(e){
            throw new Error("Not sending because transaction will fail. " + e.toString());
        }

        const txObj = await inst.setupPuzzleAndFunds(
            puzzle,
            $("input[name='shop']").val(),
            expiration,
            {from: $("input[name='payer']").val(), value: $("input[name='amount']").val()
        })
        .on("transactionHash", txHash => $("#status").html("Status: Transaction on the way " + txHash));

        const receipt = txObj.receipt;
        console.log("got receipt", receipt);

        if (!receipt.status) {
            console.error("Status: Wrong transaction status");
            console.error(receipt);
            $("#status").html("Status: There was an error in the tx execution, status not 1");
        } else if (receipt.logs.length == 0) {
            console.error("Empty logs");
            console.error(receipt);
            $("#status").html("Status: There was an error in the tx execution, missing logs");
        } else {
            console.log(receipt.logs[0]);
            $("#status").html("Status: Remittance transaction executed");
        }

    } catch (e)
    {
        $("#status").html("Status: " + e.toString());
    }

};

require("file-loader?name=../index.html!../index.html");

