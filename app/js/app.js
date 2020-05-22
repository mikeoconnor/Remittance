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

        const inst = await Remittance.new({from: window.owner});
        console.log("Contract Address", inst.address);
        $("#status").html("OK");
    } catch (e) {
        console.log("error", e);
        $("#status").html(e.toString());
    }
});

require("file-loader?name=../index.html!../index.html");

