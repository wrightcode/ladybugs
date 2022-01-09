const LadybugMinter = artifacts.require("LadybugMinter");
const utils = require("./utils");
var expect = require('chai').expect;

const ethToWeiConversion = 10**18;

// variable to keep track of all expenses incurred by owner
var brownbearStartingBalance = 0;
// we jump around in blockchain time, because some actions are time-sensitive
// so we need to track where "javascript" time is, by incrementing it as well
// during those jumps, which is done in the increase() function below.
var testTime = 0;

// current date in seconds
function getDateInSeconds() {
    return getDateInSecondsPlus(0);
}

// get date in seconds, with offset
function getDateInSecondsPlus(offsetInSeconds) {
    return Math.floor(new Date().getTime() / 1000) + offsetInSeconds;
}

function getTestTimePlus(offsetInSeconds) {
    return testTime + offsetInSeconds;
}

function convertEthToWei(ether) {
    return (ether * ethToWeiConversion).toString();
}

async function verifyActiveDropAndDateGreaterThanZero(contractInstance, number) {
    let activeDrop = await contractInstance.activeDrop();
    expect(parseInt(activeDrop.number)).to.equal(number);
    expect(parseInt(activeDrop.date)).to.be.gt(0);
}

async function verifyBalanceOf(contractInstance, owner, balance) {
    var result = await contractInstance.balanceOf(owner);
    expect(parseInt(result)).to.equal(balance);
}

async function verifyRoyalty(contractInstance, salesPrice, recipient) {
    // the token id, 3, is irrelevant, the royalty amount will be the same regardless of token
    const info = await contractInstance.royaltyInfo(3, salesPrice);
    const royalties = await contractInstance.getLadybugRoyaltyInfo();
    // dividing by 1000 below, because percentage in basis points
    // example: 2.5% is 250 basis points, but we need to multiply sales price by 0.025
    // and 0.025 is 250 / 10000
    expect(parseInt(info.royaltyAmount)).to.equal((salesPrice * royalties.basis)/10000);
    expect(royalties.receiver).to.equal(recipient);
}

//https://stackoverflow.com/a/69989325/1308695
async function increase(duration) {
    return new Promise((resolve, reject) => {
        web3.currentProvider.send({
            jsonrpc: "2.0",
            method: "evm_increaseTime",
            params: [duration],
            id: new Date().getTime()
        }, (err, result) => {
            // second call within the callback
            web3.currentProvider.send({
                jsonrpc: '2.0',
                method: 'evm_mine',
                params: [],
                id: new Date().getTime()
            }, (err, result) => {
                // need to resolve the Promise in the second callback
                resolve();
                testTime += duration;
            });
        });
    });
}

contract("LadybugMinter", (accounts) => {
    let [brownbear, larry, moe, curly, shemp] = accounts;
    let contractInstance;
    testTime = getDateInSeconds();

    before("get the ladybug minter contract instance", async () => {
        contractInstance = await LadybugMinter.new();
    });

    context("Startup: testing constructor and inheritance", async () => {
        it("deploying app should mint to owner & first drop be active", async () => {
            brownbearStartingBalance = await web3.eth.getBalance(brownbear);

            // verify there are four drops
            let drops = await contractInstance.getDrops();
            expect(drops).to.have.lengthOf(4);
            first_drop = drops[0];

            // verify the first drop (drop.number) is 1 (1-4 based, not 0-3)
            await verifyActiveDropAndDateGreaterThanZero(contractInstance, 1);

            // expect the date of the first drop to be less than now
            expect(parseInt(first_drop.date)).to.be.lte(getDateInSeconds());

            // expect the date of the remaining drops to be 0 for now
            for (let i = 1; i < drops.length; i++) {
                expect(parseInt(drops[i].date)).to.equal(0);
            }

            // owner has four ladybugs (get full objects)
            let bugIds = await contractInstance.getLadybugsByOwner(brownbear);
            expect(bugIds).to.have.lengthOf(4);

            // owner has four ladybugs (get ids only)
            let bugs = await contractInstance.getLadybugIdsByOwner(brownbear);
            expect(bugs).to.have.lengthOf(4);
        })
        it("verify owner() contains owner address", async () => {
            const owner = await contractInstance.owner();
            expect(owner).to.equal(brownbear);
        });
        it("total supply", async () => {
            const totalSupply = await contractInstance.totalSupply();
            expect(parseInt(totalSupply)).to.equal(24);
        });
        it("tokens per drop", async () => {
            const totalSupply = await contractInstance.tokensPerDrop();
            expect(parseInt(totalSupply)).to.equal(5);
        });
        it("total minted", async () => {
            const totalMinted = await contractInstance.totalMinted();
            expect(parseInt(totalMinted)).to.equal(4);
        });
        it("total unminted", async () => {
            const unminted = await contractInstance.unminted();
            expect(parseInt(unminted)).to.equal(20);
        });
        it("total supply equals total minted + total unminted", async () => {
            const totalSupply = await contractInstance.totalSupply();
            const totalMinted = await contractInstance.totalMinted();
            const unminted = await contractInstance.unminted();

            // expect total minted + unminted to equal total supply
            expect(parseInt(totalSupply)).to.equal(parseInt(totalMinted) + parseInt(unminted));
        });
        it("balanceOf, confirm pre-mint went to owner", async () => {
            // the owner should have four tokens
            await verifyBalanceOf(contractInstance, brownbear, 4);
        });
    })

    context("1st Drop confirmation", async () => {
        it("first drop is active", async () => {
            await verifyActiveDropAndDateGreaterThanZero(contractInstance, 1);
        });
        it("mint first ladybug, verify owner", async () => {
            const result = await contractInstance.mint(moe, {from: moe, value: web3.utils.toWei('0.015', 'ether'), gas: 1000000 });
            const ladybugId = result.logs[0].args.tokenId.toNumber();
            const newOwner = await contractInstance.ownerOf(ladybugId);
            expect(newOwner).to.equal(moe);
        });
    });

    context("Transfers: with the single-step scenario", async () => {
        it("mint and transfer ladybug", async () => {
            const result = await contractInstance.mint(moe, {from: moe, value: web3.utils.toWei('0.015', 'ether'), gas: 1000000 });
            const ladybugId = result.logs[0].args.tokenId.toNumber();

            // confirm this is moe's ladybug
            const owner = await contractInstance.ownerOf(ladybugId);
            expect(owner).to.equal(moe);

            // confirm larry can transfer it
            await utils.shouldThrow(contractInstance.transferFrom(moe, larry, ladybugId, {from: larry}));

            // confirm moe can transfer it
            await contractInstance.transferFrom(moe, larry, ladybugId, {from: moe});
            const newOwner = await contractInstance.ownerOf(ladybugId);
            expect(newOwner).to.equal(larry);
        })
    })

    context("Transfers: with the two-step scenario", async () => {
        it("mint ladybug and approve transfer by minter, but approved account does transfer", async () => {
            // moe mints a ladybug
            var result = await contractInstance.mint(moe, {from: moe, value: web3.utils.toWei('0.015', 'ether'), gas: 1000000 });
            const ladybugId = result.logs[0].args.tokenId.toNumber();
            // moe approves curly to recieve the ladybug
            await contractInstance.approve(curly, ladybugId, {from: moe});
            // curly does the transfer
            await contractInstance.transferFrom(moe, curly, ladybugId, {from: curly});
            // confirm curly is the new owner
            const newOwner = await contractInstance.ownerOf(ladybugId);
            expect(newOwner).to.equal(curly);
        })
        it("mint ladybug, then approve & transfer ladybug by minter", async () => {
            // moe mints a ladybug
            const result = await contractInstance.mint(moe, {from: moe, value: web3.utils.toWei('0.015', 'ether'), gas: 1000000 });
            const ladybugId = result.logs[0].args.tokenId.toNumber();
            // moe approves larry to recieve the ladybug
            await contractInstance.approve(larry, ladybugId, {from: moe});
            // moe does the transfer
            await contractInstance.transferFrom(moe, larry, ladybugId, {from: moe});
            // confirm larry is the new owner
            const newOwner = await contractInstance.ownerOf(ladybugId);
            expect(newOwner).to.equal(larry);
         })
    })

    context("Complete 1st Drop", async () => {
        it("minting with price over minimum", async () => {
            let result = await contractInstance.mint(larry, {from: larry, value: web3.utils.toWei('0.02', 'ether'), gas: 1000000 });
            let newOwner = await contractInstance.ownerOf(result.logs[0].args.tokenId.toNumber());
            expect(newOwner).to.equal(larry);
        });
        it("minting with price under minimum fails", async () => {
            await utils.shouldThrow(contractInstance.mint(curly, {from: curly, value: web3.utils.toWei('0.0001', 'ether'), gas: 1000000 }));
        });
        it("confirm no active, current drop", async () => {
            await utils.shouldThrow(contractInstance.activeDrop());
        });
        it("minting when there are no active drops", async () => {
            await utils.shouldThrow(contractInstance.mint(curly, {from: curly, value: web3.utils.toWei('0.015', 'ether'), gas: 1000000 }));
        });
        it("verify all owner counts, total minted is same as startAtIndex for next drop", async () => {
            await verifyBalanceOf(contractInstance, brownbear, 4);
            await verifyBalanceOf(contractInstance, larry, 3);
            await verifyBalanceOf(contractInstance, moe, 1);
            await verifyBalanceOf(contractInstance, curly, 1);
        });
        it("confirm mint is complete", async () => {
            // we've mostly tested this above, by confirming there's no active drop
            // but we'll re-affirm here, the total minted should now be 9
            // 4 in the pre-mint and 5 in the first drop (which are 5 each)
            let totalMinted = await contractInstance.totalMinted();
            expect(parseInt(totalMinted)).to.equal(9);
        });
    });

    context("Prepare for 2nd & 3rd drops to be back-to-back", async () => {   
        it("update 2nd drop, date == 0, within 2 hours, fails", async () => {
            let index = 1, price = convertEthToWei(0.025), dropdate = getTestTimePlus(60*60*1.5);
            let drops = await contractInstance.getDrops();
            expect(parseInt(drops[index].date)).to.equal(0);

            // update to 1.5 hours from now, should fail
            await utils.shouldThrow(contractInstance.updateDrop(index, price, dropdate, {from: brownbear}));
        });
        it("update 2nd drop successfully, 24 hours out", async () => {
            let index = 1, price = convertEthToWei(0.025), dropdate = getTestTimePlus(60*60*24);
            await contractInstance.updateDrop(index, price, dropdate, {from: brownbear});

            // check the udpate
            let drops = await contractInstance.getDrops();
            expect(drops[index].price).to.equal(price);
            expect(parseInt(drops[index].date)).to.equal(dropdate);
        });
        it("update 2nd drop within 1 hour of start, fails", async () => {
            await increase((60 * 60 * 23) + (60 * 15)); // 23 hours, 15 minutes

            let index = 1, price = convertEthToWei(0.025), dropdate = getTestTimePlus(60*60*24);
            await utils.shouldThrow(contractInstance.updateDrop(index, price, dropdate, {from: brownbear}));
        });
        it("there are still no active drops", async () => {
            // there is still no active drop, these updates are in the future
            await utils.shouldThrow(contractInstance.activeDrop());
        });
        it("2nd drop becomes active, update 3rd drop", async () => {
            const index = 2, price = convertEthToWei(0.030), dropdate = getTestTimePlus((60*60*4) + (60*8));
            await contractInstance.updateDrop(index, price, dropdate, {from: brownbear});

            // check the udpate
            let drops = await contractInstance.getDrops();
            expect(drops[index].price).to.equal(price);
            expect(parseInt(drops[index].date)).to.equal(dropdate);
        });
    });

    context("2nd & 3rd Drops", async () => {
        it("mint from 2nd drop, test getLadybugsByOnwer()", async () => {
            // speed up another 60 minutes, to make the 2nd drop active
            await increase((60 * 60 * 24) + (60 * 5)); // 1 day, 5 minutes

            // confirm there's an active drop and it's the 2nd drop
            let activeDrop = await contractInstance.activeDrop();
            expect(parseInt(activeDrop.number)).to.equal(2);

            // mint away!
            var price = web3.utils.toWei('0.025', 'ether');
            await contractInstance.mint(moe, {from: moe, value: price, gas: 1000000 });
            await contractInstance.mint(larry, {from: larry, value: price, gas: 1000000 });
            await contractInstance.mint(curly, {from: curly, value: price, gas: 1000000 });
            await contractInstance.mint(brownbear, {from: brownbear, value: price, gas: 1000000 });

            // confirmgetLadybugsByOwner() works
            let bugs = await contractInstance.getLadybugsByOwner(larry);
            expect(bugs).to.have.lengthOf(4);

            // getLadybugIdsByOwner() works
            bugs = await contractInstance.getLadybugIdsByOwner(curly);
            expect(bugs).to.have.lengthOf(2);
        });
    });

    context("Updating Drop Data", async () => {
        it("set date and price on future drop (4th) by NON-owner fails", async () => {
            let index = 3, price = convertEthToWei(0.035), dropdate = getTestTimePlus(60*60*24);
            await utils.shouldThrow(contractInstance.updateDrop(index, price, dropdate, {from: moe}));
        });
        it("set date and price on active and past drop (1st) by owner fails", async () => {
            let price = convertEthToWei(0.005), dropdate = getTestTimePlus(60*60*24);
            await utils.shouldThrow(contractInstance.updateDrop(0, price, dropdate, {from: brownbear}));
        });
    });

    context("Commplete 2nd & 3rd drops", async () => {
        it("drop price in active 2nd drop, start minting 3rd drop", async () => {
            // still on second drop
            let activeDrop = await contractInstance.activeDrop();
            expect(parseInt(activeDrop.number)).to.equal(2);

            // lower price in active drop
            let index = 1, price = convertEthToWei(0.01);
            await contractInstance.dropPrice(index, price, {from: brownbear});

            let result = await contractInstance.mint(moe, {from: moe, value: price, gas: 1000000 });
            let ladybugId = result.logs[0].args.tokenId.toNumber();
            let newOwner = await contractInstance.ownerOf(ladybugId);
            expect(newOwner).to.equal(moe);

            // should now be on 3rd drop
            activeDrop = await contractInstance.activeDrop();
            expect(parseInt(activeDrop.number)).to.equal(3);

            // price too low, expect failure
            await utils.shouldThrow(contractInstance.mint(moe, {from: moe, value: price, gas: 1000000 }));

            // raise price, mint one
            price = convertEthToWei(0.035);
            result = await contractInstance.mint(moe, {from: moe, value: price, gas: 1000000 });
            ladybugId = result.logs[0].args.tokenId.toNumber();
            newOwner = await contractInstance.ownerOf(ladybugId);
            expect(newOwner).to.equal(moe);

            let bugs = await contractInstance.getLadybugsByOwner(moe);
            expect(bugs).to.have.lengthOf(4);
            bugs = await contractInstance.getLadybugIdsByOwner(moe);
            expect(bugs).to.have.lengthOf(4);
        });
        it("finish minting 3rd drop, can't start 4th", async () => {
            activeDrop = await contractInstance.activeDrop();
            expect(parseInt(activeDrop.number)).to.equal(3);

            await contractInstance.mint(moe, {from: moe, value: activeDrop.price, gas: 1000000 });
            await contractInstance.mint(larry, {from: larry, value: activeDrop.price, gas: 1000000 });
            await contractInstance.mint(larry, {from: larry, value: activeDrop.price, gas: 1000000 });
            await contractInstance.mint(moe, {from: moe, value: activeDrop.price, gas: 1000000 });
            await utils.shouldThrow(contractInstance.mint(moe, {from: moe, value: activeDrop.price, gas: 1000000 }));

            // there are no active drops & minted is known
            await utils.shouldThrow(contractInstance.activeDrop());
            let minted = await contractInstance.totalMinted();
            expect(parseInt(minted)).to.equal(3 * 5 + 4);
        });
    });

    context("4th drop", async () => {
        it("set price on 4th drop, 25 hours out", async () => {
            let index = 3, price = convertEthToWei(0.070), dropdate = getTestTimePlus(60*60*25);
            await contractInstance.updateDrop(index, price, dropdate, {from: brownbear});

            // check the udpate
            let drops = await contractInstance.getDrops();
            expect(drops[index].price).to.equal(price);
            expect(parseInt(drops[index].number)).to.equal(4);
            expect(parseInt(drops[index].date)).to.equal(dropdate);
        });
        it("try to update price & date but within restricted time, so ... fails", async () => {
            let index = 3, price = convertEthToWei(0.075), dropdate = getTestTimePlus(60*60);
            // too soon, must be >= 2 hours out
            await utils.shouldThrow(contractInstance.updateDrop(index, price, dropdate, {from: brownbear}));
        });
        it("raise price & update date on 4th drop, 1 day in advance", async () => {
            let index = 3, price = convertEthToWei(0.075), dropdate = getTestTimePlus(60*60*3);
            await contractInstance.updateDrop(index, price, dropdate, {from: brownbear});

            // check the udpate
            let drops = await contractInstance.getDrops();
            expect(drops[index].price).to.equal(price);
            expect(parseInt(drops[index].number)).to.equal(4);
            expect(parseInt(drops[index].date)).to.equal(dropdate);
        });
        it("mint two from 4th drop", async () => {
            // skip ahead 3 hours
            await increase((60 * 60 * 3) + (60 * 1)); // 3 hours, 1 minute

            let price = convertEthToWei(0.075);
            let unminted_before_tests = await contractInstance.unminted();
            await contractInstance.mint(moe, {from: moe, value: price, gas: 1000000 });
            await contractInstance.mint(curly, {from: curly, value: price, gas: 1000000 });
            let unminted_after_tests = await contractInstance.unminted();
            expect(parseInt(unminted_after_tests)).to.equal(parseInt(unminted_before_tests) - 2);
        });
        it("lower price of fourth drop", async () => {
            let index = 3, price = convertEthToWei(0.050);
            await contractInstance.dropPrice(index, price, {from: brownbear});

            // check the udpate
            let activeDrop = await contractInstance.activeDrop();
            expect(activeDrop.price).to.equal(price);
            expect(parseInt(activeDrop.number)).to.equal(4);
        });
        it("mint from 4th until drop is complete", async () => {
            const price = convertEthToWei(0.055);
            // await contractInstance.mint(moe, {from: moe, value: price, gas: 1000000 });
            await contractInstance.mint(curly, {from: curly, value: price, gas: 1000000 });
            await contractInstance.mint(larry, {from: larry, value: price, gas: 1000000 });
            await contractInstance.mint(larry, {from: larry, value: price, gas: 1000000 });
            await utils.shouldThrow(contractInstance.mint(larry, {from: larry, value: price, gas: 1000000 }));
        });
    });

    context("Confirm all drops are complete", async () => {    
        it("there is no active drop", async () => {
            const activeDrop = await utils.shouldThrow(contractInstance.activeDrop());
        });
        it("unminted == 0", async () => {
            const unminted = await contractInstance.unminted();
            expect(parseInt(unminted)).to.equal(0);
        });
        it("totalMinted == totalSupply", async () => {
            const totalSupply = await contractInstance.totalSupply();
            const totalMinted = await contractInstance.totalMinted();
            expect(parseInt(totalSupply)).to.equal(parseInt(totalMinted));
        });

    });

    context("Royalties (ERC 2981)", async () => {
        it("confirm initial royalty configuration", async () => {
            const royalties = await contractInstance.getLadybugRoyaltyInfo();
            expect(royalties.receiver).to.equal(brownbear);
            expect(parseInt(royalties.basis)).to.equal(250);
        });
        it("update royalty configuration", async () => {
            await contractInstance.setLadybugRoyaltyInfo(shemp, 350, { from: brownbear });
            const royalties = await contractInstance.getLadybugRoyaltyInfo();
            expect(royalties.receiver).to.equal(shemp);
            expect(parseInt(royalties.basis)).to.equal(350);
        });
        it("update royalty configuration, basis too high, fails", async () => {
            await utils.shouldThrow(contractInstance.setLadybugRoyaltyInfo(shemp, 455, { from: brownbear }));
        });
        it("update royalty configuration by non-owner, fails", async () => {
            await utils.shouldThrow(contractInstance.setLadybugRoyaltyInfo(brownbear, 450, { from: moe }));
            const royalties = await contractInstance.getLadybugRoyaltyInfo();
            expect(royalties.receiver).to.equal(shemp);
            expect(parseInt(royalties.basis)).to.equal(350);
        });
        it("verify royalty price on sale price 1 eth", async () => {
            const salesPrice = convertEthToWei(1);
            await verifyRoyalty(contractInstance, salesPrice, shemp);
        });
        it("verify royalty price on sale price 10 eth", async () => {
            const salesPrice = convertEthToWei(10);
            await verifyRoyalty(contractInstance, salesPrice, shemp);
        });
        it("verify royalty price on sale price 1/2 eth", async () => {
            const salesPrice = convertEthToWei(0.5);
            await verifyRoyalty(contractInstance, salesPrice, shemp);
        });
        it("verify royalty price on sale price 1/100 eth", async () => {
            const salesPrice = convertEthToWei(0.01);
            await verifyRoyalty(contractInstance, salesPrice, shemp);
        });
        it("supports interface", async () => {
            // ensure the contract supports _INTERFACE_ID_ERC2981
            const supports = await contractInstance.supportsInterface('0x2a55205a');
            expect(supports).to.be.true;
        });
        xit("verify royalties on rarible", async () => {
            // mint a token & get token id (ladybugId)
            const royalties = await contractInstance.getRaribleV2Royalties(5);
            expect(royalties).to.have.lengthOf(1);
            expect(royalties[0].value).to.equal('250');

            const balance = await contractInstance.balanceInContract();
            expect(parseInt(balance)).to.equal(0);

            // verify owner get paid the royalties

            // simulate a sale of the token to new user...???
        });
        xit("verify royalties on erc2981", async () => {
            // mint a token & get token id (ladybugId)
            const result = await contractInstance.mint(moe, {from: moe, value: web3.utils.toWei('0.015', 'ether'), gas: 1000000 });
            const ladybugId = result.logs[0].args.tokenId.toNumber();
            // during minting, royalties are set, so let's make sure this is true and the royalties are set to 250
            const royalties = await contractInstance.getRaribleV2Royalties(ladybugId);
            expect(royalties).to.have.lengthOf(1);
            expect(royalties[0].value).to.equal('250');
            // check the royalties on the ERC2981
            const salesPrice = 1000000;
            const info = await contractInstance.royaltyInfo(ladybugId, salesPrice);
            console.log('salesPrice: ' + salesPrice);
            console.log('info: ' + info);
            console.log('info.royaltyAmount: ' + royaltyAmount);

            // dividing by 1000 below, because percentage in basis points
            // example: 2.5% is 250 basis points, but we need to multiply sales price by 0.025
            // and 0.025 is 250 / 10000
            expect(info.royaltyAmount.toNumber()).to.equal(parseInt(royalties[0].value)/10000 * salesPrice);

            // ensure the contract supports _INTERFACE_ID_ERC2981
            const supports = await contractInstance.supportsInterface('0x2a55205a');
            expect(supports).to.be.true;

            // verify owner get paid the royalties
        });
        it("set opensea royalties/output requirements", async () => {
            const result = await contractInstance.contractURI();
            // hard-coded to test ipfs url
            expect(result).to.equal('ipfs://QmdUBpQ8tgeSB8cdkPpdawvvaXrubzBKVuKfygxtFAnhmW');
        });
    });

    context("Admin Tasks", async () => {
        it("withdraw funds by non-owner fails", async () => {
            await utils.shouldThrow(contractInstance.withdraw({from: curly}));
        });
        it("withdraw funds to pay owner", async () => {

            // let's grab the owners initial balance & contract balance
            const owner_init_balance = await web3.eth.getBalance(brownbear);
            const contract_init_balance = await contractInstance.balanceInContract();
            expect(parseInt(contract_init_balance)).to.be.gt(0);

            // make the withdrawl and get the gas cost from the transaction
            const receipt = await contractInstance.withdraw({from: brownbear});
            const tx = await web3.eth.getTransaction(receipt.tx);
            const txReceipt = await web3.eth.getTransactionReceipt(receipt.receipt.transactionHash);
            const gasCost = tx.gasPrice * txReceipt.gasUsed;

            // balance after withdrawl should be zero
            const balanceAfterWithdrawl = await contractInstance.balanceInContract();
            expect(parseInt(balanceAfterWithdrawl)).to.equal(0);

            // the owners new balance should equal the initial balance plus the amount transfered from contract minus the gas costs
            const owner_new_balance = await web3.eth.getBalance(brownbear);
            expect(parseInt(owner_new_balance)).to.equal(parseInt(owner_init_balance) + parseInt(contract_init_balance) - parseInt(gasCost));

        });
    });

});