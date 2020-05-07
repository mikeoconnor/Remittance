const Remittance = artifacts.require("Remittance");

contract('Remittance - Wen new contract', (accounts) => {
    const owner = accounts[0]
    const alice = accounts[4];
    const carol = accounts[6];
    const puzzle = "0x59ad4eece649151190b2031d6f9be33630b48b2e16db4650c0e151cab81f6bc2";

    let instance = null;
    let tx = null;

    beforeEach('set up default contract', async () => {
        instance = await Remittance.new({from: owner});
    });

    it('should be in Initial state', async () => {
        const state = await instance.state();
        assert.equal(state.toString(10), 0);
    });


    it('should allow alice to set puzzle with funds', async () => {
        tx = await instance.setupPuzzleAndFunds(puzzle, {from: alice, value: web3.utils.toWei('2', 'ether')});
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
            assert.include(error.message, "Contract not in Ready state");
        }
    });
});

contract('Remittance -When puzzle set by alice', (accounts) => {
    const owner = accounts[0]
    const alice = accounts[4];
    const carol = accounts[6];
    const puzzle = "0x59ad4eece649151190b2031d6f9be33630b48b2e16db4650c0e151cab81f6bc2";

    beforeEach('set up contract with puzzle and funds from alice', async () => {
        instance = await Remittance.new({from: owner});
        await instance.setupPuzzleAndFunds(puzzle, {from: alice, value: web3.utils.toWei('2', 'ether')});
    });

    it('Should be in the Ready state', async () => {
        const state = await instance.state();
        assert.equal(state.toString(10), 1);
    });

    it('Should no allow alice to reset puzzle', async () => {
        try{
            await instance.setupPuzzleAndFunds(puzzle, {from: alice, value: web3.utils.toWei('2', 'ether')});
            throw null;
        } catch(error) {
            assert.isNotNull(error, "Expected an error but did not get one");
            assert.include(error.message, "revert");
            assert.include(error.message, "Contract not in Initial state");
        }
    });

    it('Should no allow carol to solve puzzle with incorrect data', async () => {
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
});


