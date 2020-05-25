const Remittance = artifacts.require("Remittance");
const tm = require('ganache-time-traveler');
const truffleAssert = require('truffle-assertions');

let instance = null;
let tx = null;
let puzzle = null;

const secret2 = web3.utils.asciiToHex("onetime2");
const secret4 = web3.utils.asciiToHex("boy");
const text = web3.utils.asciiToHex("onetime1");
const text2 = web3.utils.asciiToHex("onetime2");
const expectedAmount = "2000000000000000000";
const toBN = web3.utils.toBN;
const getBalance = web3.eth.getBalance;
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
        tx = await instance.setupPuzzleAndFunds(puzzle, carol, THIRTY_DAYS_IN_FUTURE,
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
            "no funds"
        );
    });
});

contract('Remittance -Given puzzle set by alice', (accounts) => {
    const owner = accounts[0]
    const alice = accounts[4];
    const carol = accounts[6];

    beforeEach('set up contract with puzzle and funds from alice', async () => {
        instance = await Remittance.new({from: owner});
        puzzle = await instance.generatePuzzle(carol, secret2);
        await instance.setupPuzzleAndFunds(puzzle, carol, THIRTY_DAYS_IN_FUTURE,
            {from: alice, value: web3.utils.toWei('2', 'ether')});
    });

    it('Should not allow alice to reset puzzle', async () => {
        await truffleAssert.reverts(
            instance.setupPuzzleAndFunds(puzzle, carol, THIRTY_DAYS_IN_FUTURE,
                {from: alice, value: web3.utils.toWei('2', 'ether')}),
            "puzzle should be zero"
        );
    });

    it('Should not allow carol to solve puzzle with incorrect data', async () => {
        await truffleAssert.reverts(
            instance.solvePuzzleAndClaimFunds(text, {from: carol}),
            "no funds"
        );
    });

    it('Should allow carol to solve puzzle and collect funds', async () => {
        tx = await instance.solvePuzzleAndClaimFunds(text2, {from: carol});
        truffleAssert.eventEmitted(tx, 'LogClaimFunds', (ev) => {
            return ev.sender === carol && ev.amount.toString(10) === expectedAmount && ev.puzzle !== 0;
        });
    });

    it('Should not allow alice to reclaim the funds before expiration', async () => {
        await truffleAssert.reverts(
            instance.payerReclaimFundsAfterExpirationDate(carol, secret2, {from: alice}),
            "not expired"
        );
    });

    it('Should allow carol to solve puzzle and collect funds (verifying claimed funds)', async () => {
        let balanceBefore = toBN(await getBalance(carol));
        tx = await instance.solvePuzzleAndClaimFunds(text2, {from: carol});
        let trans = await web3.eth.getTransaction(tx.tx);
        let balanceAfter = toBN(await getBalance(carol));
        let gasPrice = toBN(trans.gasPrice);
        let gasUsed = toBN(tx.receipt.gasUsed);
        let amountClaimed = toBN(tx.logs[0].args.amount);
        let gasCost = gasPrice.mul(gasUsed);
        assert.isTrue(balanceAfter.eq(balanceBefore.add(amountClaimed).sub(gasCost)));
    });
});

contract('Remittance -Given puzzle set by alice and solved by carol', (accounts) => {
    const owner = accounts[0]
    const alice = accounts[4];
    const carol = accounts[6];

    beforeEach('set up contract with puzzle and funds from alice then solve by carol', async () => {
        instance = await Remittance.new({from: owner});
        puzzle = await instance.generatePuzzle(carol, secret2);
        await instance.setupPuzzleAndFunds(puzzle, carol, THIRTY_DAYS_IN_FUTURE,
            {from: alice, value: web3.utils.toWei('2', 'ether')});
        await instance.solvePuzzleAndClaimFunds(text2, {from: carol});
    });

    it('Should not allow alice to reset puzzle', async () => {
        await truffleAssert.reverts(
            instance.setupPuzzleAndFunds(puzzle, carol, THIRTY_DAYS_IN_FUTURE,
                {from: alice, value: web3.utils.toWei('2', 'ether')}),
            "puzzle should be zero"
        );
    });

    it ('Should not allow Carol to solve puzzle', async () => {
        await truffleAssert.reverts(
            instance.solvePuzzleAndClaimFunds(text2, {from: carol}),
            "no funds"
        );
    });

    it('Should not allow alice to reclaim the funds before expiration', async () => {
        await truffleAssert.reverts(
            instance.payerReclaimFundsAfterExpirationDate(carol, secret2, {from: alice}),
            "no funds"
        );
    });
});

contract('Remittance - Given expiration date has expired', (accounts) => {
    const owner = accounts[0]
    const alice = accounts[4];
    const carol = accounts[6];

    before('set up contract with puzzle and funds from alice', async() => {
        instance = await Remittance.new({from: owner});
        puzzle = await instance.generatePuzzle(carol, secret2);
        await instance.setupPuzzleAndFunds(puzzle, carol, THIRTY_DAYS_IN_FUTURE,
            {from: alice, value: web3.utils.toWei('2', 'ether')});
        let snapshot = await tm.takeSnapshot();
        snapshotId = snapshot.result;
    });

    after(async() => {
        await tm.revertToSnapshot(snapshotId);
    });

    it ('Should allow alice to reclaim funds after expiration date (if not solved by carol)', async() => {
        await tm.advanceBlockAndSetTime(FORTY_DAYS_IN_FUTURE);
        tx = await instance.payerReclaimFundsAfterExpirationDate(carol, secret2, {from: alice});
        truffleAssert.eventEmitted(tx, 'LogPayerReclaimsFunds', (ev) => {
            return ev.sender === alice && ev.amount.toString(10) === expectedAmount && ev.puzzle !== 0;
        });
    });

    it ('Should then not allow carol to solve the puzzle', async() => {
        await truffleAssert.reverts(
            instance.solvePuzzleAndClaimFunds(text2, {from: carol}),
            "no funds"
        );
    });
});

contract('Remittance - Given expiration date has expired', (accounts) => {
    const owner = accounts[0]
    const alice = accounts[4];
    const carol = accounts[6];

    before('set up contract with puzzle and funds from alice', async() => {
        instance = await Remittance.new({from: owner});
        puzzle = await instance.generatePuzzle(carol, secret2);
        await instance.setupPuzzleAndFunds(puzzle, carol, THIRTY_DAYS_IN_FUTURE,
            {from: alice, value: web3.utils.toWei('2', 'ether')});
        let snapshot = await tm.takeSnapshot();
        snapshotId = snapshot.result;
    });

    after(async() => {
        await tm.revertToSnapshot(snapshotId);
    });

    it ('Should allow Carol to solve puzzle after expiration date (if not reclaimed by alice)', async () => {
        await tm.advanceBlockAndSetTime(FORTY_DAYS_IN_FUTURE);
        tx = await instance.solvePuzzleAndClaimFunds(text2, {from: carol});
        truffleAssert.eventEmitted(tx, 'LogClaimFunds', (ev) => {
            return ev.sender === carol && ev.amount.toString(10) === expectedAmount && ev.puzzle !== 0;
        });
    });

    it ('Should then not allow to reclaim the funds', async() => {
        await truffleAssert.reverts(
            instance.payerReclaimFundsAfterExpirationDate(carol, secret2, {from: alice}),
            "no funds"
        );
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
        tx = await instance.setupPuzzleAndFunds(puzzle, carol, THIRTY_DAYS_IN_FUTURE,
                {from: alice, value: web3.utils.toWei('2', 'ether')});
        truffleAssert.eventEmitted(tx, 'LogSetup', (ev) => {
             return  ev.sender === alice && ev.shop === carol &&
                     ev.amount.toString(10) === expectedAmount && ev.puzzle !== 0 &&
                     ev.expirationDate.toString(10) === THIRTY_DAYS_IN_FUTURE.toString(10);
        });
    });

    it ('Should then allow alice to set another puzzle with funds', async () => {
        puzzle = await instance.generatePuzzle(bob, secret4);
        tx = await instance.setupPuzzleAndFunds(puzzle, bob, THIRTY_DAYS_IN_FUTURE,
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

    before('set up contract with two sets of puzzles and funds from alice', async () => {
        instance = await Remittance.new({from: owner});
        puzzle = await instance.generatePuzzle(carol, secret2);
        await instance.setupPuzzleAndFunds(puzzle, carol, THIRTY_DAYS_IN_FUTURE,
            {from: alice, value: web3.utils.toWei('2', 'ether')});
        puzzle = await instance.generatePuzzle(bob, secret4);
        await instance.setupPuzzleAndFunds(puzzle, bob, THIRTY_DAYS_IN_FUTURE,
            {from: alice, value: web3.utils.toWei('2', 'ether')});
    });

    it('Should allow carol to solve puzzle and collect funds', async () => {
        tx = await instance.solvePuzzleAndClaimFunds(text2, {from: carol});
        truffleAssert.eventEmitted(tx, 'LogClaimFunds', (ev) => {
            return ev.sender === carol && ev.amount.toString(10) === expectedAmount && ev.puzzle !== 0;
        });
    });

    it('Should then allow bob to solve puzzle and collect funds', async () => {
        tx = await instance.solvePuzzleAndClaimFunds(secret4, {from: bob});
        truffleAssert.eventEmitted(tx, 'LogClaimFunds', (ev) => {
            return ev.sender === bob && ev.amount.toString(10) === expectedAmount && ev.puzzle !== 0;
        });
    });
});

