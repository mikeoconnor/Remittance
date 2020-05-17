const Remittance = artifacts.require("Remittance");
const tm = require('ganache-time-traveler');
const truffleAssert = require('truffle-assertions');

let instance = null;
let tx = null;
let puzzle = null;
const secret1 = "onetime1";
const secret2 = "onetime2";
const secret3 = "big";
const secret4 = "boy";
const text = "onetime1";
const text2 = "onetime2";
const expectedAmount = "2000000000000000000";

// The expiration date
const Tue_15_Sep_00_00_00_BST_2020 = 1600124400;

// Ten days after expiration date
const Fri_25_Sep_00_00_00_BST_2020 = 1600988400;

contract('Remittance - Given new contract', (accounts) => {
    const owner = accounts[0]
    const alice = accounts[4];
    const carol = accounts[6];

    beforeEach('set up default contract', async () => {
        instance = await Remittance.new({from: owner});
    });

    it('should allow alice to set puzzle with funds', async () => {
        puzzle = await instance.generatePuzzle(secret1, secret2);
        tx = await instance.setupPuzzleAndFunds(puzzle, Tue_15_Sep_00_00_00_BST_2020,
                {from: alice, value: web3.utils.toWei('2', 'ether')});
        truffleAssert.eventEmitted(tx, 'LogSetup', (ev) => {
             return  ev.sender === alice && ev.amount.toString(10) === expectedAmount &&
                     ev.puzzle !== 0 &&
                     ev.expirationDate.toString(10) === Tue_15_Sep_00_00_00_BST_2020.toString(10);
        });
    });

    it ('Should not allow Carol to solve puzzle', async () => {
        await truffleAssert.reverts(
            instance.solvePuzzleAndClaimFunds(text, text, {from: carol}),
            "Puzzle not solved"
        );
    });
});

contract('Remittance -Given puzzle set by alice', (accounts) => {
    const owner = accounts[0]
    const alice = accounts[4];
    const carol = accounts[6];

    beforeEach('set up contract with puzzle and funds from alice', async () => {
        instance = await Remittance.new({from: owner});
        puzzle = await instance.generatePuzzle(secret1, secret2);
        await instance.setupPuzzleAndFunds(puzzle, Tue_15_Sep_00_00_00_BST_2020,
            {from: alice, value: web3.utils.toWei('2', 'ether')});
    });

    it('Should not allow alice to reset puzzle', async () => {
        await truffleAssert.reverts(
            instance.setupPuzzleAndFunds(puzzle, Tue_15_Sep_00_00_00_BST_2020,
                {from: alice, value: web3.utils.toWei('2', 'ether')}),
            "puzzle should be zero"
        );
    });

    it('Should not allow carol to solve puzzle with incorrect data', async () => {
        await truffleAssert.reverts(
            instance.solvePuzzleAndClaimFunds(text, text, {from: carol}),
            "Puzzle not solved"
        );
    });

    it('Should allow carol to solve puzzle and collect funds', async () => {
        tx = await instance.solvePuzzleAndClaimFunds(text, text2, {from: carol});
        truffleAssert.eventEmitted(tx, 'LogClaimFunds', (ev) => {
            return ev.sender === carol && ev.amount.toString(10) === expectedAmount;
        });
    });

    it('Should not allow alice to reclaim the funds before expiration', async () => {
        await truffleAssert.reverts(
            instance.payerReclaimFundsAfterExpirationDate(secret1, secret2, {from: alice}),
            "not expired"
        );
    });
});

contract('Remittance -Given puzzle set by alice and solved by carol', (accounts) => {
    const owner = accounts[0]
    const alice = accounts[4];
    const carol = accounts[6];

    beforeEach('set up contract with puzzle and funds from alice then solve by carol', async () => {
        instance = await Remittance.new({from: owner});
        puzzle = await instance.generatePuzzle(secret1, secret2);
        await instance.setupPuzzleAndFunds(puzzle, Tue_15_Sep_00_00_00_BST_2020,
            {from: alice, value: web3.utils.toWei('2', 'ether')});
        await instance.solvePuzzleAndClaimFunds(text, text2, {from: carol});
    });

    it('Should not allow alice to reset puzzle', async () => {
        await truffleAssert.reverts(
            instance.setupPuzzleAndFunds(puzzle, Tue_15_Sep_00_00_00_BST_2020,
                {from: alice, value: web3.utils.toWei('2', 'ether')}),
            "puzzle should be zero"
        );
    });

    it ('Should not allow Carol to solve puzzle', async () => {
        await truffleAssert.reverts(
            instance.solvePuzzleAndClaimFunds(text, text2, {from: carol}),
            "no funds"
        );
    });

    it('Should not allow alice to reclaim the funds before expiration', async () => {
        await truffleAssert.reverts(
            instance.payerReclaimFundsAfterExpirationDate(secret1, secret2, {from: alice}),
            "not expired"
        );
    });
});

contract('Remittance - Given expiration date has expired', (accounts) => {
    const owner = accounts[0]
    const alice = accounts[4];
    const carol = accounts[6];

    before('set up contract with puzzle and funds from alice', async() => {
        instance = await Remittance.new({from: owner});
        puzzle = await instance.generatePuzzle(secret1, secret2);
        await instance.setupPuzzleAndFunds(puzzle, Tue_15_Sep_00_00_00_BST_2020,
            {from: alice, value: web3.utils.toWei('2', 'ether')});
        let snapshot = await tm.takeSnapshot();
        snapshotId = snapshot.result;
    });

    after(async() => {
        await tm.revertToSnapshot(snapshotId);
    });

    it ('Should allow alice to reclaim funds after expiration date (if not solved by carol)', async() => {
        await tm.advanceBlockAndSetTime(Fri_25_Sep_00_00_00_BST_2020);
        tx = await instance.payerReclaimFundsAfterExpirationDate(secret1, secret2, {from: alice});
        truffleAssert.eventEmitted(tx, 'LogPayerReclaimsFunds', (ev) => {
            return ev.sender === alice && ev.amount.toString(10) === expectedAmount;
        });
    });

    it ('Should then not allow carol to solve the puzzle', async() => {
        await truffleAssert.reverts(
            instance.solvePuzzleAndClaimFunds(text, text2, {from: carol}),
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
        puzzle = await instance.generatePuzzle(secret1, secret2);
        await instance.setupPuzzleAndFunds(puzzle, Tue_15_Sep_00_00_00_BST_2020,
            {from: alice, value: web3.utils.toWei('2', 'ether')});
        let snapshot = await tm.takeSnapshot();
        snapshotId = snapshot.result;
    });

    after(async() => {
        await tm.revertToSnapshot(snapshotId);
    });

    it ('Should allow Carol to solve puzzle after expiration date (if not reclaimed by alice)', async () => {
        await tm.advanceBlockAndSetTime(Fri_25_Sep_00_00_00_BST_2020);
        tx = await instance.solvePuzzleAndClaimFunds(text, text2, {from: carol});
        truffleAssert.eventEmitted(tx, 'LogClaimFunds', (ev) => {
            return ev.sender === carol && ev.amount.toString(10) === expectedAmount;
        });
    });

    it ('Should then not allow to reclaim the funds', async() => {
        await truffleAssert.reverts(
            instance.payerReclaimFundsAfterExpirationDate(secret1, secret2, {from: alice}),
            "no funds"
        );
    });
});

contract('Remittance - Given new contract', (accounts) => {
    const owner = accounts[0]
    const alice = accounts[4];
    const carol = accounts[6];

    before('set up default contract', async () => {
        instance = await Remittance.new({from: owner});
    });

    it('should allow alice to set puzzle with funds', async () => {
        puzzle = await instance.generatePuzzle(secret1, secret2);
        tx = await instance.setupPuzzleAndFunds(puzzle, Tue_15_Sep_00_00_00_BST_2020,
                {from: alice, value: web3.utils.toWei('2', 'ether')});
        truffleAssert.eventEmitted(tx, 'LogSetup', (ev) => {
             return  ev.sender === alice && ev.amount.toString(10) === expectedAmount &&
                     ev.puzzle !== 0 &&
                     ev.expirationDate.toString(10) === Tue_15_Sep_00_00_00_BST_2020.toString(10);
        });
    });

    it ('Should then allow alice to set another puzzle with funds', async () => {
        puzzle = await instance.generatePuzzle(secret3, secret4);
        tx = await instance.setupPuzzleAndFunds(puzzle, Tue_15_Sep_00_00_00_BST_2020,
                {from: alice, value: web3.utils.toWei('2', 'ether')});
        truffleAssert.eventEmitted(tx, 'LogSetup', (ev) => {
             return  ev.sender === alice && ev.amount.toString(10) === expectedAmount &&
                     ev.puzzle !== 0 &&
                     ev.expirationDate.toString(10) === Tue_15_Sep_00_00_00_BST_2020.toString(10);
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
        puzzle = await instance.generatePuzzle(secret1, secret2);
        await instance.setupPuzzleAndFunds(puzzle, Tue_15_Sep_00_00_00_BST_2020,
            {from: alice, value: web3.utils.toWei('2', 'ether')});
        puzzle = await instance.generatePuzzle(secret3, secret4);
        await instance.setupPuzzleAndFunds(puzzle, Tue_15_Sep_00_00_00_BST_2020,
            {from: alice, value: web3.utils.toWei('2', 'ether')});
    });

    it('Should allow carol to solve puzzle and collect funds', async () => {
        tx = await instance.solvePuzzleAndClaimFunds(text, text2, {from: carol});
        truffleAssert.eventEmitted(tx, 'LogClaimFunds', (ev) => {
            return ev.sender === carol && ev.amount.toString(10) === expectedAmount;
        });
    });

    it('Should then allow bob to solve puzzle and collect funds', async () => {
        tx = await instance.solvePuzzleAndClaimFunds("big", "boy", {from: bob});
        truffleAssert.eventEmitted(tx, 'LogClaimFunds', (ev) => {
            return ev.sender === bob && ev.amount.toString(10) === expectedAmount;
        });
    });
});

