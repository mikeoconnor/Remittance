const Remittance = artifacts.require("Remittance");
const tm = require('ganache-time-traveler');

let instance = null;
let tx = null;
let puzzle = null;
const secret1 = "onetime1";
const secret2 = "onetime2";
const text = "onetime1";
const text2 = "onetime2";

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
        tx = await instance.setupPuzzleAndFunds(puzzle, Tue_15_Sep_00_00_00_BST_2020, {from: alice, value: web3.utils.toWei('2', 'ether')});
        const { logs } = tx;
        const log = logs[0];
        assert.equal(log.event, 'LogSetup');
        assert.equal(log.args.sender, alice);
        assert.equal(log.args.amount.toString(10), web3.utils.toWei('2', 'ether').toString(10));
        assert.equal(log.args.puzzle, puzzle);
    });

    it ('Should not allow Carol to solve puzzle', async () => {
        try{
            const text = "onetime1";
            await instance.solvePuzzleAndClaimFunds(text, text, {from: carol});
            throw null;
        } catch(error) {
            assert.isNotNull(error, "Expected an error but did not get one");
            assert.include(error.message, "revert");
            assert.include(error.message, "no puzzle");
        }
    });
});

contract('Remittance -Given puzzle set by alice', (accounts) => {
    const owner = accounts[0]
    const alice = accounts[4];
    const carol = accounts[6];

    beforeEach('set up contract with puzzle and funds from alice', async () => {
        instance = await Remittance.new({from: owner});
        puzzle = await instance.generatePuzzle(secret1, secret2);
        await instance.setupPuzzleAndFunds(puzzle, Tue_15_Sep_00_00_00_BST_2020, {from: alice, value: web3.utils.toWei('2', 'ether')});
    });

    it('Should not allow alice to reset puzzle', async () => {
        try{
            await instance.setupPuzzleAndFunds(puzzle, Tue_15_Sep_00_00_00_BST_2020, {from: alice, value: web3.utils.toWei('2', 'ether')});
            throw null;
        } catch(error) {
            assert.isNotNull(error, "Expected an error but did not get one");
            assert.include(error.message, "revert");
            assert.include(error.message, "puzzle should be zero");
        }
    });

    it('Should not allow carol to solve puzzle with incorrect data', async () => {
        try{
            const text = "onetime1";
            await instance.solvePuzzleAndClaimFunds(text, text, {from: carol});
            throw null;
        } catch(error) {
            assert.isNotNull(error, "Expected an error but did not get one");
            assert.include(error.message, "revert");
            assert.include(error.message, "Puzzle not solved");
        }
    });

    it('Should allow carol to solve puzzle and collect funds', async () => {
        const text = "onetime1";
        const text2 = "onetime2";
        tx = await instance.solvePuzzleAndClaimFunds(text, text2, {from: carol});
        const { logs } = tx;
        const log = logs[0];
        assert.equal(log.event, 'LogClaimFunds');
        assert.equal(log.args.sender, carol);
        assert.equal(log.args.amount.toString(10), web3.utils.toWei('2', 'ether').toString(10));
    });

    it('Should allow alice reclaim the funds before expiration', async () => {
        try{
            await instance.payerReclaimFundsAfterExpirationDate({from: alice});
            throw null;
        } catch(error) {
            assert.isNotNull(error, "Expected an error but did not get one");
            assert.include(error.message, "revert");
            assert.include(error.message, "not expired");
        }
    });
});

contract('Remittance -Given puzzle set by alice and solved by carol', (accounts) => {
    const owner = accounts[0]
    const alice = accounts[4];
    const carol = accounts[6];

    beforeEach('set up contract with puzzle and funds from alice then solve by carol', async () => {
        instance = await Remittance.new({from: owner});
        puzzle = await instance.generatePuzzle(secret1, secret2);
        await instance.setupPuzzleAndFunds(puzzle, Tue_15_Sep_00_00_00_BST_2020, {from: alice, value: web3.utils.toWei('2', 'ether')});
        await instance.solvePuzzleAndClaimFunds(text, text2, {from: carol});
    });

    it('Should not allow alice to reset puzzle', async () => {
        try{
            await instance.setupPuzzleAndFunds(puzzle, Tue_15_Sep_00_00_00_BST_2020, {from: alice, value: web3.utils.toWei('2', 'ether')});
            throw null;
        } catch(error) {
            assert.isNotNull(error, "Expected an error but did not get one");
            assert.include(error.message, "revert");
            assert.include(error.message, "puzzle should be zero");
        }
    });

    it ('Should not allow Carol to solve puzzle', async () => {
        try{
            await instance.solvePuzzleAndClaimFunds(text, text, {from: carol});
            throw null;
        } catch(error) {
            assert.isNotNull(error, "Expected an error but did not get one");
            assert.include(error.message, "revert");
            assert.include(error.message, "no funds");
        }
    });

    it('Should allow alice reclaim the funds', async () => {
        try{
            await instance.payerReclaimFundsAfterExpirationDate({from: alice});
            throw null;
        } catch(error) {
            assert.isNotNull(error, "Expected an error but did not get one");
            assert.include(error.message, "revert");
            assert.include(error.message, "not expired");
        }
    });
});

contract('Remittance - Given expiration date has expired', (accounts) => {
    const owner = accounts[0]
    const alice = accounts[4];
    const carol = accounts[6];

    beforeEach('set up contract with puzzle and funds from alice', async() => {
        instance = await Remittance.new({from: owner});
        puzzle = await instance.generatePuzzle(secret1, secret2);
        await instance.setupPuzzleAndFunds(puzzle, Tue_15_Sep_00_00_00_BST_2020, {from: alice, value: web3.utils.toWei('2', 'ether')});
        let snapshot = await tm.takeSnapshot();
        snapshotId = snapshot.result;
    });

    afterEach(async() => {
        await tm.revertToSnapshot(snapshotId);
    });

    it ('Should allow alice to reclaim funds after expiration date', async () => {
        await tm.advanceBlockAndSetTime(Fri_25_Sep_00_00_00_BST_2020);
        tx = await instance.payerReclaimFundsAfterExpirationDate({from: alice});
        const { logs } = tx;
        const log = logs[0];
        assert.equal(log.event, 'LogPayerReclaimsFunds');
        assert.equal(log.args.sender, alice);
        assert.equal(log.args.amount.toString(10), web3.utils.toWei('2', 'ether').toString(10));
        // It should then not allow carol to solve the puzzle.
        try{
            await instance.solvePuzzleAndClaimFunds(text, text, {from: carol});
            throw null;
        } catch(error) {
            assert.isNotNull(error, "Expected an error but did not get one");
            assert.include(error.message, "revert");
            assert.include(error.message, "no funds");
        }
    });

    it ('Should not allow Carol to solve puzzle after expiration date', async () => {
        await tm.advanceBlockAndSetTime(Fri_25_Sep_00_00_00_BST_2020);
        tx = await instance.solvePuzzleAndClaimFunds(text, text2, {from: carol});
        const { logs } = tx;
        const log = logs[0];
        assert.equal(log.event, 'LogClaimFunds');
        assert.equal(log.args.sender, carol);
        assert.equal(log.args.amount.toString(10), web3.utils.toWei('2', 'ether').toString(10));
        // It should then not allow alice to reclaim the funds.
        try{
            await instance.payerReclaimFundsAfterExpirationDate({from: alice});
            throw null;
        } catch(error) {
            assert.isNotNull(error, "Expected an error but did not get one");
            assert.include(error.message, "revert");
            assert.include(error.message, "no funds");
        }
    });
});

