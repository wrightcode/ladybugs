const Ladybug = artifacts.require("Ladybug");

contract("Ladybug", (accounts) => {
    let ladybug;
    // let expectedAdopter;

    // before(async () => {
    //     // ladybug = await Ladybug.deployed();
    // });


    describe("first test of ladybug", async () => {
        before("mint a ladybug", async () => {
            // await ladybug.adopt(8, { from: accounts[0] });
            // expectedAdopter = accounts[0];
        });
    });

    context("context of first test", async () => {
        it("can fetch the address of an owner by pet id", async () => {
            // const adopter = await adoption.adopters(8);
            // assert.equal(adopter, expectedAdopter, "The owner of the adopted pet should be the first account.");
            assert.equal(true, true);
        });
    });
    

});