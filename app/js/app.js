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
        const inst = await Remittance.deployed();
        $("#address").html("Contract Address: " + inst.address);
        $("#status").html("Status: OK.");
        $("#send").click(setup);
        $("#claim").click(solve);
    } catch (e) {
        console.log("error", e);
        $("#status").html("Status: " + e.toString());
    }
});

const setup = async () => {
    try {
        const inst = await Remittance.deployed();
        const puzzle = await inst.generatePuzzle($("input[name='shop']").val(), web3.utils.asciiToHex($("input[name='password']").val()));

        //Expiration date is hard fixed to be 30 days from now.
        const DAYS30 = 30*86400;
        const expiration = Math.floor(Date.now() / 1000) + DAYS30;

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
            $("#status").html("Status: Remittance created");
        }

    } catch (e){
        $("#status").html("Status: " + e.toString());
    }

};

const solve = async () => {
    try {
        const inst = await Remittance.deployed();

        try{
            await inst.solvePuzzleAndClaimFunds.call(
                web3.utils.asciiToHex($("input[name='password2']").val()),
                {from: $("input[name='shop2']").val()
            });
        } catch(e)
        {
            throw new Error("Not sending because transaction will fail. " + e.toString());
        }

        const txObj = await inst.solvePuzzleAndClaimFunds(
            web3.utils.asciiToHex($("input[name='password2']").val()),
            {from: $("input[name='shop2']").val()
        })
        .on("transactionHash", txHash => $("#status2").html("Status: Transaction on the way " + txHash));

        const receipt = txObj.receipt;
        console.log("got receipt", receipt);

        if (!receipt.status) {
            console.error("Status: Wrong transaction status");
            console.error(receipt);
            $("#status2").html("Status: There was an error in the tx execution, status not 1");
        } else if (receipt.logs.length == 0) {
            console.error("Empty logs");
            console.error(receipt);
            $("#status2").html("Status: There was an error in the tx execution, missing logs");
        } else {
            console.log(receipt.logs[0]);
            $("#status2").html("Status: Remittance claimed");
        }
    } catch (e) {
        $("#status2").html("Status: " + e.toString());
    }
};

require("file-loader?name=../index.html!../index.html");

