const Remittance = artifacts.require("Remittance");

contract('Remittance - default', (accounts) => {
  it('Should comeup default', async () => {
    const remittanceIns = await Remittance.deployed();
    const state = await remittanceIns.state();
    assert.equal(state, 0); 
  });
});


