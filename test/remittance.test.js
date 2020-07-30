const Remittance = artifacts.require("Remittance");
const tm = require('ganache-time-traveler');
const truffleAssert = require('truffle-assertions');

const Web3 = require('web3');
const { waitForEvent } = require('./utils.js');
const web3ws = new Web3(new Web3.providers.WebsocketProvider('ws://127.0.0.1:8545'));

let instance = null;
let puzzle = null;

const secret2 = web3.utils.asciiToHex("onetime2");
const secret4 = web3.utils.asciiToHex("boy");
const text = web3.utils.asciiToHex("onetime1");
const text2 = web3.utils.asciiToHex("onetime2");
const expectedAmount = "2000000000000000000";
const toBN = web3.utils.toBN;
const getBalance = web3.eth.getBalance;
const expectedAmountUsCents = 40000; // 400.00 USD
const DAY = 24*60*60;

// The expiration date
const THIRTY_DAYS_IN_FUTURE = Math.floor(Date.now() /1000) + 30*DAY;

// Ten days after expiration date
const FORTY_DAYS_IN_FUTURE = Math.floor(Date.now() /1000) + 40*DAY;

contract('Remittance - Given new contract', (accounts) => {
    const owner = accounts[0]
    const alice = accounts[4];
    const carol = accounts[6];

    beforeEach('set up default contract', async () => {
        instance = await Remittance.new({from: owner});
    });

    it('should allow alice to set puzzle with funds', async () => {
        puzzle = await instance.generatePuzzle(carol, secret2);
        const tx = await instance.setupPuzzleAndFunds(puzzle, carol, THIRTY_DAYS_IN_FUTURE, expectedAmountUsCents,
                {from: alice, value: web3.utils.toWei('2', 'ether')});
        truffleAssert.eventEmitted(tx, 'LogSetup', (ev) => {
             return  ev.sender === alice && ev.shop === carol &&
                     ev.amount.toString(10) === expectedAmount && ev.puzzle !== 0 &&
                     ev.expirationDate.toString(10) === THIRTY_DAYS_IN_FUTURE.toString(10);
        });
    });

    it ('Should not allow Carol to solve puzzle', async () => {
        await truffleAssert.reverts(
            instance.solvePuzzleAndClaimFunds(text, {from: carol}),
            "puzzle not set"
        );
    });
});

contract('Remittance -Given puzzle set by alice', (accounts) => {
    const owner = accounts[0]
    const alice = accounts[4];
    const carol = accounts[6];
    let events = null;

    beforeEach('set up contract with puzzle and funds from alice', async () => {
        instance = await Remittance.new({from: owner});
        puzzle = await instance.generatePuzzle(carol, secret2);
        await instance.setupPuzzleAndFunds(puzzle, carol, THIRTY_DAYS_IN_FUTURE, expectedAmountUsCents,
            {from: alice, value: web3.utils.toWei('2', 'ether')});
    });

    it('Should not allow alice to reset puzzle', async () => {
        await truffleAssert.reverts(
            instance.setupPuzzleAndFunds(puzzle, carol, THIRTY_DAYS_IN_FUTURE, expectedAmountUsCents,
                {from: alice, value: web3.utils.toWei('2', 'ether')}),
            "puzzle should not be set"
        );
    });

    it('Should not allow carol to solve puzzle with incorrect data', async () => {
        await truffleAssert.reverts(
            instance.solvePuzzleAndClaimFunds(text, {from: carol}),
            "puzzle not set"
        );
    });

    it('Should not allow alice to reclaim the funds before expiration', async () => {
        await truffleAssert.reverts(
            instance.payerReclaimFunds(carol, secret2, {from: alice}),
            "not expired"
        );
    });
});

contract('Remittance -Given puzzle set by alice', (accounts) => {
    const owner = accounts[0]
    const alice = accounts[4];
    const carol = accounts[6];
    let events = null;
    let amountSent = null;
    let queryPrice = null;

    before('set up contract with puzzle and funds from alice', async () => {
        instance = await Remittance.new({from: owner});
        ({ events } = new web3ws.eth.Contract(instance.abi, instance.address));
        puzzle = await instance.generatePuzzle(carol, secret2);
        await instance.setupPuzzleAndFunds(puzzle, carol, THIRTY_DAYS_IN_FUTURE, expectedAmountUsCents,
            {from: alice, value: web3.utils.toWei('2', 'ether')});
    });

    it('Should allow carol to solve puzzle and collect funds', async () => {
        const balanceBefore = toBN(await getBalance(carol));
        const tx = await instance.solvePuzzleAndClaimFunds(text2, {from: carol});
        truffleAssert.eventEmitted(tx, 'LogQuery', (ev) => {
            return ev.sender === carol && ev.id !== 0 && ev.puzzle !== 0;
        });
        queryPrice = tx.logs[0].args.queryPrice;

        // wait for LogPriceEthUsCent event
        const eventPrice = await waitForEvent(events.LogPriceEthUsCent);
        const EthUsCent = eventPrice.returnValues.ethUsCent;
        assert.isTrue(EthUsCent > 0);

        // wait for LogClaimFunds event
        const eventFunds = await waitForEvent(events.LogClaimFunds);
        amountSent = eventFunds.returnValues.amount;

        // verify the shop (carol) balance
        const gasPrice = (await web3.eth.getTransaction(tx.tx)).gasPrice;
        const gasUsed = tx.receipt.gasUsed;
        const gasCost = toBN(gasPrice).mul(toBN(gasUsed));
        const balanceAfter = toBN(await getBalance(carol));
        assert.isTrue(balanceAfter.eq(balanceBefore.add(toBN(amountSent).sub(gasCost))));
    });

    it('Should then allow alice to withdraw the excess funds', async () => {
        const txFunds = await instance.payerReclaimFunds(carol, secret2, {from: alice});
        truffleAssert.eventEmitted(txFunds, 'LogPayerReclaimsFunds', (ev) => {
            return ev.sender === alice && ev.amount !== 0 && ev.puzzle !== 0;
        });
        const amountReclaimedAlice = txFunds.logs[0].args.amount;

        // verify that the initial funds paid by alice get split into an amount sent to carol
        // and an amount reclaimed by alice and an amount to pay provable for the query
        assert.isTrue(toBN(expectedAmount).eq(amountReclaimedAlice.add(toBN(amountSent).add(queryPrice))));
    });
});

contract('Remittance -Given puzzle set by alice and solved by carol', (accounts) => {
    const owner = accounts[0]
    const alice = accounts[4];
    const carol = accounts[6];
    let events = null;

    beforeEach('set up contract with puzzle and funds from alice then solve by carol', async () => {
        instance = await Remittance.new({from: owner});
        ({ events } = new web3ws.eth.Contract(instance.abi, instance.address));
        puzzle = await instance.generatePuzzle(carol, secret2);
        await instance.setupPuzzleAndFunds(puzzle, carol, THIRTY_DAYS_IN_FUTURE, expectedAmountUsCents,
            {from: alice, value: web3.utils.toWei('2', 'ether')});
        await instance.solvePuzzleAndClaimFunds(text2, {from: carol});
        await waitForEvent(events.LogClaimFunds);
    });

    it('Should not allow alice to reset puzzle', async () => {
        await truffleAssert.reverts(
            instance.setupPuzzleAndFunds(puzzle, carol, THIRTY_DAYS_IN_FUTURE, expectedAmountUsCents,
                {from: alice, value: web3.utils.toWei('2', 'ether')}),
            "puzzle should not be set"
        );
    });

    it ('Should not allow Carol to solve puzzle', async () => {
        await truffleAssert.reverts(
            instance.solvePuzzleAndClaimFunds(text2, {from: carol}),
            "puzzle not set"
        );
    });

    it('Should allow alice to reclaim excess funds ', async () => {
        const tx = await instance.payerReclaimFunds(carol, secret2, {from: alice});
        truffleAssert.eventEmitted(tx, 'LogPayerReclaimsFunds', (ev) => {
            return ev.sender === alice && ev.amount.toString(10) !== "0" && ev.puzzle !== 0;
        });
    });
});

contract('Remittance - Given expiration date has expired', (accounts) => {
    const owner = accounts[0]
    const alice = accounts[4];
    const carol = accounts[6];

    before('set up contract with puzzle and funds from alice', async() => {
        instance = await Remittance.new({from: owner});
        puzzle = await instance.generatePuzzle(carol, secret2);
        await instance.setupPuzzleAndFunds(puzzle, carol, THIRTY_DAYS_IN_FUTURE, expectedAmountUsCents,
            {from: alice, value: web3.utils.toWei('2', 'ether')});
        let snapshot = await tm.takeSnapshot();
        snapshotId = snapshot.result;
    });

    after(async() => {
        await tm.revertToSnapshot(snapshotId);
    });

    it ('Should allow alice to reclaim funds after expiration date (if not solved by carol)', async() => {
        await tm.advanceBlockAndSetTime(FORTY_DAYS_IN_FUTURE);
        const tx = await instance.payerReclaimFunds(carol, secret2, {from: alice});
        truffleAssert.eventEmitted(tx, 'LogPayerReclaimsFunds', (ev) => {
            return ev.sender === alice && ev.amount.toString(10) === expectedAmount && ev.puzzle !== 0;
        });
    });

    it ('Should then not allow carol to solve the puzzle', async() => {
        await truffleAssert.reverts(
            instance.solvePuzzleAndClaimFunds(text2, {from: carol}),
            "puzzle not set"
        );
    });
});

contract('Remittance - Given expiration date has expired', (accounts) => {
    const owner = accounts[0]
    const alice = accounts[4];
    const carol = accounts[6];
    let events = null;

    before('set up contract with puzzle and funds from alice', async() => {
        instance = await Remittance.new({from: owner});
        ({ events } = new web3ws.eth.Contract(instance.abi, instance.address));
        puzzle = await instance.generatePuzzle(carol, secret2);
        await instance.setupPuzzleAndFunds(puzzle, carol, THIRTY_DAYS_IN_FUTURE, expectedAmountUsCents,
            {from: alice, value: web3.utils.toWei('2', 'ether')});
        let snapshot = await tm.takeSnapshot();
        snapshotId = snapshot.result;
    });

    after(async() => {
        await tm.revertToSnapshot(snapshotId);
    });

    it ('Should allow Carol to solve puzzle after expiration date (if not reclaimed by alice)', async () => {
        await tm.advanceBlockAndSetTime(FORTY_DAYS_IN_FUTURE);
        const tx = await instance.solvePuzzleAndClaimFunds(text2, {from: carol});

        truffleAssert.eventEmitted(tx, 'LogQuery', (ev) => {
            return ev.sender === carol && ev.id !== 0 && ev.queryPrice !== 0 && ev.puzzle !== 0;
        });
    });

    it ('Should then allow alice to reclaim excess funds', async() => {
        const tx = await instance.payerReclaimFunds(carol, secret2, {from: alice});
        truffleAssert.eventEmitted(tx, 'LogPayerReclaimsFunds', (ev) => {
            return ev.sender === alice && ev.amount.toString(10) !== "0" && ev.puzzle !== 0;
        });
    });
});

contract('Remittance - Given new contract', (accounts) => {
    const owner = accounts[0]
    const alice = accounts[4];
    const bob = accounts[5];
    const carol = accounts[6];

    before('set up default contract', async () => {
        instance = await Remittance.new({from: owner});
    });

    it('should allow alice to set puzzle with funds', async () => {
        puzzle = await instance.generatePuzzle(carol, secret2);
        const tx = await instance.setupPuzzleAndFunds(puzzle, carol, THIRTY_DAYS_IN_FUTURE, expectedAmountUsCents,
                {from: alice, value: web3.utils.toWei('2', 'ether')});
        truffleAssert.eventEmitted(tx, 'LogSetup', (ev) => {
             return  ev.sender === alice && ev.shop === carol &&
                     ev.amount.toString(10) === expectedAmount && ev.puzzle !== 0 &&
                     ev.expirationDate.toString(10) === THIRTY_DAYS_IN_FUTURE.toString(10);
        });
    });

    it ('Should then allow alice to set another puzzle with funds', async () => {
        puzzle = await instance.generatePuzzle(bob, secret4);
        const tx = await instance.setupPuzzleAndFunds(puzzle, bob, THIRTY_DAYS_IN_FUTURE, expectedAmountUsCents,
                {from: alice, value: web3.utils.toWei('2', 'ether')});
        truffleAssert.eventEmitted(tx, 'LogSetup', (ev) => {
             return  ev.sender === alice && ev.shop === bob &&
                     ev.amount.toString(10) === expectedAmount && ev.puzzle !== 0 &&
                     ev.expirationDate.toString(10) === THIRTY_DAYS_IN_FUTURE.toString(10);
        });
    });
});

contract('Remittance - Given two puzzles set by alice', (accounts) => {
    const owner = accounts[0]
    const alice = accounts[4];
    const bob = accounts[5];
    const carol = accounts[6];
    let events = null

    before('set up contract with two sets of puzzles and funds from alice', async () => {
        instance = await Remittance.new({from: owner});
        ({ events } = new web3ws.eth.Contract(instance.abi, instance.address));
        puzzle = await instance.generatePuzzle(carol, secret2);
        await instance.setupPuzzleAndFunds(puzzle, carol, THIRTY_DAYS_IN_FUTURE, expectedAmountUsCents,
            {from: alice, value: web3.utils.toWei('2', 'ether')});
        puzzle = await instance.generatePuzzle(bob, secret4);
        await instance.setupPuzzleAndFunds(puzzle, bob, THIRTY_DAYS_IN_FUTURE, expectedAmountUsCents,
            {from: alice, value: web3.utils.toWei('2', 'ether')});
    });

    it('Should allow carol to solve puzzle and collect funds', async () => {
        const tx = await instance.solvePuzzleAndClaimFunds(text2, {from: carol});
        truffleAssert.eventEmitted(tx, 'LogQuery', (ev) => {
            return ev.sender === carol && ev.id !== 0 && ev.queryPrice !== 0 && ev.puzzle !== 0;
        });
    });

    it('Should then allow bob to solve puzzle and collect funds', async () => {
        const tx = await instance.solvePuzzleAndClaimFunds(secret4, {from: bob});
        truffleAssert.eventEmitted(tx, 'LogQuery', (ev) => {
            return ev.sender === bob && ev.id !== 0 && ev.queryPrice !== 0 && ev.puzzle !== 0;
        });
    });
});

