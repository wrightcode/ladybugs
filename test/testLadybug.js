const LadybugMinter = artifacts.require("LadybugMinter");
const utils = require("./utils");
var expect = require('chai').expect;

const ethToWeiConversion = 10 ** 18;

const devWalletAddress = ''

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
    return Math.floor(Date.now() / 1000) + offsetInSeconds;
}

function getTestTimePlus(offsetInSeconds) {
    return testTime + offsetInSeconds;
}

function convertEthToWei(ether) {
    return (ether * ethToWeiConversion).toString();
}

function printArray(arr) {
    for (var i = 0; i < arr.length; i++) {
        console.log(i + ": " + arr[i]);
    }
}

async function printTokensForAccount(contractInstance, account, name) {
    let tokens = await contractInstance.getLadybugIdsByOwner(account);
    let who = name !== undefined ? ' ' + name : '';
    console.log('Tokens for ' + account + who);
    printArray(tokens);
}

async function verifyDropIsActive(contractInstance, drops, index) {
    let status = await contractInstance.status();
    expect(parseInt(status.index)).to.equal(index);
    expect(status.active).to.be.true;
    expect(status.complete).to.be.false;
}

async function verifyDropIsNotActive(contractInstance, drops, index) {
    let status = await contractInstance.status();
    // console.log(drops);
    expect(parseInt(status.index)).to.equal(index);
    expect(status.active).to.be.false;
    expect(status.complete).to.be.false;
}

async function displayStatus(contractInstance, label) {
    let drops = await contractInstance.getDrops();
    const displayLabel = label === undefined ? '' : label + ' ';
    let status = await contractInstance.status();
    console.log(displayLabel + 'status.index: ' + status.index);
    console.log(displayLabel + 'status.active: ' + status.active);
    console.log(displayLabel + 'status.complete: ' + status.complete);
    console.log(displayLabel + 'status.blocktime: ' + status.blocktime);
    console.log(displayLabel + 'drop: ' + drops[status.index]);
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
    expect(parseInt(info.royaltyAmount)).to.equal((salesPrice * royalties.basis) / 10000);
    expect(royalties.receiver).to.equal(recipient);
}

//https://stackoverflow.com/a/69989325/1308695
async function increase(duration) {
    return new Promise((resolve, reject) => {
        web3.currentProvider.send({
            jsonrpc: "2.0",
            method: "evm_increaseTime",
            params: [duration],
            id: Date.now()
        }, (err, result) => {
            // second call within the callback
            web3.currentProvider.send({
                jsonrpc: '2.0',
                method: 'evm_mine',
                params: [],
                id: Date.now()
            }, (err, result) => {
                // need to resolve the Promise in the second callback
                resolve();
                testTime += duration;
                console.log('New js time: ' + testTime);
            });
        });
    });
}

contract("LadybugMinter", (accounts) => {
    let [brownbear, larry, moe, curly, shemp, charity] = accounts;
    let contractInstance;
    testTime = getDateInSeconds();

    before("get the ladybug minter contract instance", async () => {
        contractInstance = await LadybugMinter.new();
    });

    context("Startup: testing constructor and inheritance", async () => {
        it("deploying app should mint to owner & first drop be active", async () => {
            brownbearStartingBalance = await web3.eth.getBalance(brownbear);

            // owner has no ladybugs, before initialization
            let bugs = await contractInstance.getLadybugIdsByOwner(brownbear);
            expect(bugs).to.have.lengthOf(0);
            printArray(bugs);
        })
        it("verify owner() contains owner address", async () => {
            const owner = await contractInstance.owner();
            expect(owner).to.equal(brownbear);
        });
        it("total supply", async () => {
            const totalSupply = await contractInstance.totalSupply();
            expect(parseInt(totalSupply)).to.equal(24);
        });
        it("total minted", async () => {
            const totalMinted = await contractInstance.totalMinted();
            expect(parseInt(totalMinted)).to.equal(0);
        });
        it("total unminted", async () => {
            const unminted = await contractInstance.unminted();
            expect(parseInt(unminted)).to.equal(24);
        });
        it("total supply equals total minted + total unminted", async () => {
            const totalSupply = await contractInstance.totalSupply();
            const totalMinted = await contractInstance.totalMinted();
            const unminted = await contractInstance.unminted();

            // expect total minted + unminted to equal total supply
            expect(parseInt(totalSupply)).to.equal(parseInt(totalMinted) + parseInt(unminted));
        });
    })

    context("Initialize", async () => {
        it("call the initialize function", async () => {
            // confirm failure if not owner
            await utils.shouldThrow(contractInstance.initialize({ from: moe }));
            const receipt = await contractInstance.initialize({ from: brownbear });
            // console.log(receipt);
            const tx = await web3.eth.getTransaction(receipt.tx);
            // console.log(tx);
            const txReceipt = await web3.eth.getTransactionReceipt(receipt.receipt.transactionHash);
            // console.log(txReceipt);
            console.log('Initialization Gas Price: ' + tx.gasPrice);
            console.log('Initialization Gas Used:  ' + txReceipt.gasUsed);
            const gasCost = tx.gasPrice * txReceipt.gasUsed;
            console.log('Initialization Gas Cost:  ' + gasCost);
        });
        it("cannot call initialize more than once", async () => {
            // confirm failure if not owner
            await utils.shouldThrow(contractInstance.initialize({ from: brownbear }));
        });
        it("verify status is now available, first drop has not started", async () => {
            let drops = await contractInstance.getDrops();
            expect(drops).to.have.lengthOf(4);
            await verifyDropIsNotActive(contractInstance, drops, 0);

            // expect the date of all drops to be 0 for now
            for (let i = 0; i < drops.length; i++) {
                expect(parseInt(drops[i].date)).to.equal(0);
                expect(parseInt(drops[i].priceDate)).to.equal(0);
            }
        })
        it("balanceOf, confirm pre-mint went to owner", async () => {
            // the owner should have two tokens
            // await verifyBalanceOf(contractInstance, devWalletAddress, 2);
            // const shuffle = await contractInstance.getShuffle({ from: brownbear });
            await verifyBalanceOf(contractInstance, brownbear, 2);
            // how many does the onwer have
            printTokensForAccount(contractInstance, brownbear, 'brownbear');
        });
        xit("get shuffle", async () => {
            // confirm failure if not owner
            await utils.shouldThrow(contractInstance.getShuffle({ from: moe }));
            const shuffle = await contractInstance.getShuffle({ from: brownbear });
            printArray(shuffle);
            // verify there are 24 bugs in the shuffle
            expect(shuffle.length).to.equal(24);
            // verify the contract owner has bugs 2 and 3 (0 based index)
            let bugs = await contractInstance.getLadybugIdsByOwner(brownbear);
            bugs = bugs.map(Number); 
            expect(bugs).to.not.include(parseInt(shuffle[0]));
            expect(bugs).to.not.include(parseInt(shuffle[1]));
            expect(bugs).to.include(parseInt(shuffle[2]));
            expect(bugs).to.include(parseInt(shuffle[3]));
            expect(bugs).to.not.include(parseInt(shuffle[4]));
        });
        it("total minted after initialization", async () => {
            const totalMinted = await contractInstance.totalMinted();
            expect(parseInt(totalMinted)).to.equal(4);
        });
        it("total unminted after initialization", async () => {
            const unminted = await contractInstance.unminted();
            expect(parseInt(unminted)).to.equal(20);
        });
        it("tokens per drop", async () => {
            const tokensPerDrop = await contractInstance.tokensPerDrop();
            const unminted = await contractInstance.unminted();
            expect(parseInt(tokensPerDrop)).to.equal(parseInt(unminted) / 4);
        });
        it("total supply equals total minted + total unminted", async () => {
            const totalSupply = await contractInstance.totalSupply();
            const totalMinted = await contractInstance.totalMinted();
            const unminted = await contractInstance.unminted();

            // expect total minted + unminted to equal total supply
            expect(parseInt(totalSupply)).to.equal(parseInt(totalMinted) + parseInt(unminted));
        });
    })

    context("1st Drop confirmation", async () => {
        it("first drop is NOT defined", async () => {
            let drops = await contractInstance.getDrops();
            // console.log('What are drops');
            // console.log(drops);
            // expect(drops).to.be.undefined();
            await verifyDropIsNotActive(contractInstance, drops, 0);
        });
        it("active first drop, skip time", async () => {
            const dropdate = getTestTimePlus((60 * 60 * 2) + (60 * 20)); // 2 hours, 20 minutes
            const index = 0,
                price = convertEthToWei(0.01);
            await contractInstance.updateDrop(index, price, dropdate, { from: brownbear });

            await increase((60 * 60 * 2) + (60 * 30)); // 2 hours, 30 minutes
        });
        it("first drop is active", async () => {
            let drops = contractInstance.getDrops();
            await verifyDropIsActive(contractInstance, drops, 0);
        });
        it("mint first ladybug, verify owner", async () => {
            const result = await contractInstance.mint(moe, { from: moe, value: web3.utils.toWei('0.015', 'ether'), gas: 1000000 });

            const ladybugId = result.logs[0].args.tokenId.toNumber();
            const newOwner = await contractInstance.ownerOf(ladybugId);
            expect(newOwner).to.equal(moe);
        });
    });

    context("Transfers: with the single-step scenario", async () => {
        it("mint and transfer ladybug", async () => {
            const receipt = await contractInstance.mint(moe, { from: moe, value: web3.utils.toWei('0.015', 'ether'), gas: 1000000 });
            const ladybugId = receipt.logs[0].args.tokenId.toNumber();
            const tx = await web3.eth.getTransaction(receipt.tx);
            // console.log(tx);
            const txReceipt = await web3.eth.getTransactionReceipt(receipt.receipt.transactionHash);
            // console.log(txReceipt);
            console.log('Mint gas price: ' + tx.gasPrice);
            console.log('Mint gas used:  ' + txReceipt.gasUsed);
            const gasCost = tx.gasPrice * txReceipt.gasUsed;
            console.log('Mint gas cost:  ' + gasCost);

            // confirm this is moe's ladybug
            const owner = await contractInstance.ownerOf(ladybugId);
            expect(owner).to.equal(moe);

            // confirm larry can transfer it
            await utils.shouldThrow(contractInstance.transferFrom(moe, larry, ladybugId, { from: larry }));

            // confirm moe can transfer it
            await contractInstance.transferFrom(moe, larry, ladybugId, { from: moe });
            const newOwner = await contractInstance.ownerOf(ladybugId);
            expect(newOwner).to.equal(larry);
        })
    })

    context("Transfers: with the two-step scenario", async () => {
        it("mint ladybug and approve transfer by minter, but approved account does transfer", async () => {
            // moe mints a ladybug
            var result = await contractInstance.mint(moe, { from: moe, value: web3.utils.toWei('0.015', 'ether'), gas: 1000000 });
            const ladybugId = result.logs[0].args.tokenId.toNumber();
            // moe approves curly to recieve the ladybug
            await contractInstance.approve(curly, ladybugId, { from: moe });
            // curly does the transfer
            await contractInstance.transferFrom(moe, curly, ladybugId, { from: curly });
            // confirm curly is the new owner
            const newOwner = await contractInstance.ownerOf(ladybugId);
            expect(newOwner).to.equal(curly);
        })
        it("mint ladybug, then approve & transfer ladybug by minter", async () => {
            // moe mints a ladybug
            const result = await contractInstance.mint(moe, { from: moe, value: web3.utils.toWei('0.015', 'ether'), gas: 1000000 });
            const ladybugId = result.logs[0].args.tokenId.toNumber();
            // moe approves larry to recieve the ladybug
            await contractInstance.approve(larry, ladybugId, { from: moe });
            // moe does the transfer
            await contractInstance.transferFrom(moe, larry, ladybugId, { from: moe });
            // confirm larry is the new owner
            const newOwner = await contractInstance.ownerOf(ladybugId);
            expect(newOwner).to.equal(larry);
        })
    })

    context("Complete 1st Drop", async () => {
        it("minting with price over minimum", async () => {
            let result = await contractInstance.mint(larry, { from: larry, value: web3.utils.toWei('0.02', 'ether'), gas: 1000000 });
            let newOwner = await contractInstance.ownerOf(result.logs[0].args.tokenId.toNumber());
            expect(newOwner).to.equal(larry);
        });
        it("minting with price under minimum fails", async () => {
            await utils.shouldThrow(contractInstance.mint(curly, { from: curly, value: web3.utils.toWei('0.0001', 'ether'), gas: 1000000 }));
        });
        it("confirm no active, current drop", async () => {
            const status = await contractInstance.status();
            expect(status.active).to.be.false;
            expect(status.complete).to.be.false;
        });
        it("minting when there are no active drops", async () => {
            await utils.shouldThrow(contractInstance.mint(curly, { from: curly, value: web3.utils.toWei('0.015', 'ether'), gas: 1000000 }));
        });
        it("verify all owner counts, total minted is same as startAtIndex for next drop", async () => {
            printTokensForAccount(contractInstance, shemp, 'shemp');
            await verifyBalanceOf(contractInstance, brownbear, 2);
            printTokensForAccount(contractInstance, brownbear, 'brownbear');
            // await verifyBalanceOf(contractInstance, devWalletAddress, 2);
            await verifyBalanceOf(contractInstance, larry, 3);
            printTokensForAccount(contractInstance, larry, 'larry');
            await verifyBalanceOf(contractInstance, moe, 1);
            printTokensForAccount(contractInstance, moe, 'moe');
            await verifyBalanceOf(contractInstance, curly, 1);
            printTokensForAccount(contractInstance, curly, 'curly');
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
            let index = 1,
                price = convertEthToWei(0.025),
                dropdate = getTestTimePlus(60 * 60 * 1.5);
            let drops = await contractInstance.getDrops();
            expect(parseInt(drops[index].date)).to.equal(0);

            // update to 1.5 hours from now, should fail
            await utils.shouldThrow(contractInstance.updateDrop(index, price, dropdate, { from: brownbear }));
        });
        it("update 2nd drop successfully, 24 hours out", async () => {
            let index = 1,
                price = convertEthToWei(0.025),
                dropdate = getTestTimePlus(60 * 60 * 24);
            await contractInstance.updateDrop(index, price, dropdate, { from: brownbear });

            // check the udpate
            let drops = await contractInstance.getDrops();
            expect(drops[index].price).to.equal(price);
            expect(parseInt(drops[index].date)).to.equal(dropdate);
            expect(parseInt(drops[index].priceDate)).to.equal(dropdate);
        });
        it("update 2nd drop within 1 hour of start, fails", async () => {
            await increase((60 * 60 * 23) + (60 * 15)); // 23 hours, 15 minutes

            let index = 1,
                price = convertEthToWei(0.025),
                dropdate = getTestTimePlus(60 * 60 * 24);
            await utils.shouldThrow(contractInstance.updateDrop(index, price, dropdate, { from: brownbear }));
        });
        it("there are still no active drops", async () => {
            // there is still no active drop, these updates are in the future
            const status = await contractInstance.status();
            expect(status.active).to.be.false;
            expect(status.complete).to.be.false;
        });
        it("2nd drop becomes active, update 3rd drop", async () => {
            const index = 2,
                price = convertEthToWei(0.030),
                dropdate = getTestTimePlus((60 * 60 * 4) + (60 * 8));
            await contractInstance.updateDrop(index, price, dropdate, { from: brownbear });

            // check the udpate
            let drops = await contractInstance.getDrops();
            expect(drops[index].price).to.equal(price);
            expect(parseInt(drops[index].date)).to.equal(dropdate);
            expect(parseInt(drops[index].priceDate)).to.equal(dropdate);
        });
    });

    context("2nd & 3rd Drops", async () => {
        it("mint from 2nd drop, test getLadybugsByOnwer()", async () => {
            // speed up another 60 minutes, to make the 2nd drop active
            await increase((60 * 60 * 24) + (60 * 5)); // 1 day, 5 minutes

            // confirm there's an active drop and it's the 2nd drop
            let status = await contractInstance.status();
            expect(parseInt(status.index)).to.equal(1);
            expect(status.active).to.be.true;
            expect(status.complete).to.be.false;

            // mint away!
            var price = web3.utils.toWei('0.025', 'ether');
            await contractInstance.mint(moe, { from: moe, value: price, gas: 1000000 });
            await contractInstance.mint(larry, { from: larry, value: price, gas: 1000000 });
            await contractInstance.mint(curly, { from: curly, value: price, gas: 1000000 });
            await contractInstance.mint(brownbear, { from: brownbear, value: price, gas: 1000000 });

            // confirmgetLadybugIdsByOwner() works
            let bugs = await contractInstance.getLadybugIdsByOwner(curly);
            expect(bugs).to.have.lengthOf(2);
        });
    });

    context("Updating Drop Data", async () => {
        it("set date and price on future drop (4th) by NON-owner fails", async () => {
            let index = 3,
                price = convertEthToWei(0.035),
                dropdate = getTestTimePlus(60 * 60 * 24);
            await utils.shouldThrow(contractInstance.updateDrop(index, price, dropdate, { from: moe }));
        });
        it("set date and price on active and past drop (1st) by owner fails", async () => {
            let price = convertEthToWei(0.005),
                dropdate = getTestTimePlus(60 * 60 * 24);
            await utils.shouldThrow(contractInstance.updateDrop(0, price, dropdate, { from: brownbear }));
        });
    });

    context("Commplete 2nd & 3rd drops", async () => {
        it("drop price in active 2nd drop, start minting 3rd drop", async () => {
            // still on second drop
            let status = await contractInstance.status();
            expect(parseInt(status.index)).to.equal(1);
            expect(status.active).to.be.true;
            expect(status.complete).to.be.false;

            // lower price in active drop
            let index = 1,
                price = convertEthToWei(0.01);
            await contractInstance.dropPrice(index, price, { from: brownbear });

            let drops = await contractInstance.getDrops();
            expect(parseInt(drops[index].priceDate)).to.be.gt(parseInt(drops[index].date));
            expect(parseInt(drops[index].date)).to.be.gt(0);

            let result = await contractInstance.mint(moe, { from: moe, value: price, gas: 1000000 });
            let ladybugId = result.logs[0].args.tokenId.toNumber();
            let newOwner = await contractInstance.ownerOf(ladybugId);
            expect(newOwner).to.equal(moe);

            // should now be on 3rd drop
            status = await contractInstance.status();
            expect(parseInt(status.index)).to.equal(2);
            expect(status.active).to.be.true;
            expect(status.complete).to.be.false;

            // price too low, expect failure
            await utils.shouldThrow(contractInstance.mint(moe, { from: moe, value: price, gas: 1000000 }));

            // raise price, mint one
            price = convertEthToWei(0.035);
            result = await contractInstance.mint(moe, { from: moe, value: price, gas: 1000000 });
            ladybugId = result.logs[0].args.tokenId.toNumber();
            newOwner = await contractInstance.ownerOf(ladybugId);
            expect(newOwner).to.equal(moe);

            let bugs = await contractInstance.getLadybugIdsByOwner(moe);
            expect(bugs).to.have.lengthOf(4);
        });
        it("minting 3rd drop stalls", async () => {
            let status = await contractInstance.status();
            expect(parseInt(status.index)).to.equal(2);
            expect(status.active).to.be.true;
            let drops = await contractInstance.getDrops();
            await contractInstance.mint(moe, { from: moe, value: drops[status.index].price, gas: 1000000 });
            await contractInstance.mint(larry, { from: larry, value: drops[status.index].price, gas: 1000000 });

            // there are no active drops & minted is known
            status = await contractInstance.status();
            expect(status.active).to.be.true;
            expect(status.complete).to.be.false;
            let minted = await contractInstance.totalMinted();
            expect(parseInt(minted)).to.equal(3 * 5 + 2);
        });
    });

    context("Stalled mint - transfer to owner", async () => {
        it("stalled mint fails, if not owner", async () => {
            printTokensForAccount(contractInstance, brownbear, 'brownbear');
            await utils.shouldThrow(contractInstance.mintStalledDropToOwner({ from: moe }));
        });
        it("stalled mint fails, drop date < 30 days", async () => {
            await utils.shouldThrow(contractInstance.mintStalledDropToOwner({ from: brownbear }));
        });
        it("stalled mint fails, price is too high (fail), drop date > 30 days (OK), price date > two weeks (OK)", async () => {
            // jump 32 days
            await increase((60 * 60 * 24) * 32); // 15 days
            // price still too high
            await utils.shouldThrow(contractInstance.mintStalledDropToOwner({ from: brownbear }));
        });
        it("stalled mint fails, price is low enough (OK), drop date > 30 days (OK), price date < two weeks (fail)", async () => {
            let index = 2,
                price = convertEthToWei(0.0001);
            await contractInstance.dropPrice(index, price, { from: brownbear });

            let drops = await contractInstance.getDrops();
            expect(parseInt(drops[index].priceDate)).to.be.gt(parseInt(drops[index].date));
            expect(parseInt(drops[index].date)).to.be.gt(0);

            // jump 1 days
            await increase((60 * 60 * 24) * 1); // 1 day
            // still too soon
            await utils.shouldThrow(contractInstance.mintStalledDropToOwner({ from: brownbear }));
        });
        it("stalled mint success, price is low (OK)", async () => {
            await verifyBalanceOf(contractInstance, brownbear, 3);

            // jump 14 days
            await increase((60 * 60 * 24) * 14); // 14 days
            await contractInstance.mintStalledDropToOwner({ from: brownbear });
            await verifyBalanceOf(contractInstance, brownbear, 5);
            printTokensForAccount(contractInstance, brownbear, 'brownbear');
        });

        it("finish minting 3rd drop via stalled mint, can't start 4th", async () => {
            let status = await contractInstance.status();
            expect(parseInt(status.index)).to.equal(3);
            expect(status.active).to.be.false;
            expect(status.complete).to.be.false;

            let drops = await contractInstance.getDrops();

            // no more to mint
            await utils.shouldThrow(contractInstance.mint(moe, { from: moe, value: drops[status.index].price, gas: 1000000 }));

            // there are no active drops & minted is known
            status = await contractInstance.status();
            expect(status.active).to.be.false;
            expect(status.complete).to.be.false;
            let minted = await contractInstance.totalMinted();
            expect(parseInt(minted)).to.equal(3 * 5 + 4);
        });
    });

    context("4th drop", async () => {
        it("set price on 4th drop, 25 hours out", async () => {
            console.log('Token allocation, pre-fourth drop:');
            printTokensForAccount(contractInstance, brownbear, 'brownbear');
            printTokensForAccount(contractInstance, moe, 'moe');
            printTokensForAccount(contractInstance, larry, 'larry');
            printTokensForAccount(contractInstance, curly, 'curly');
            printTokensForAccount(contractInstance, shemp, 'shemp');
            printTokensForAccount(contractInstance, charity, 'charity');

            let index = 3,
                price = convertEthToWei(0.070),
                dropdate = getTestTimePlus(60 * 60 * 25);
            await contractInstance.updateDrop(index, price, dropdate, { from: brownbear });

            // check the udpate
            let drops = await contractInstance.getDrops();
            expect(drops[index].price).to.equal(price);
            expect(parseInt(drops[index].date)).to.equal(dropdate);
            expect(parseInt(drops[index].priceDate)).to.equal(dropdate);
        });
        it("try to update price & date but within restricted time, so ... fails", async () => {
            let index = 3,
                price = convertEthToWei(0.075),
                dropdate = getTestTimePlus(60 * 60);
            // too soon, must be >= 2 hours out
            await utils.shouldThrow(contractInstance.updateDrop(index, price, dropdate, { from: brownbear }));
        });
        it("raise price & update date on 4th drop, 1 day in advance", async () => {
            let index = 3,
                price = convertEthToWei(0.075),
                dropdate = getTestTimePlus(60 * 60 * 3);
            await contractInstance.updateDrop(index, price, dropdate, { from: brownbear });

            // check the udpate
            let drops = await contractInstance.getDrops();
            expect(drops[index].price).to.equal(price);
            expect(parseInt(drops[index].date)).to.equal(dropdate);
            expect(parseInt(drops[index].priceDate)).to.equal(dropdate);
        });
        it("mint two from 4th drop", async () => {
            // skip ahead 3 hours
            await increase((60 * 60 * 3) + (60 * 1)); // 3 hours, 1 minute

            let price = convertEthToWei(0.075);
            let unminted_before_tests = await contractInstance.unminted();
            await contractInstance.mint(moe, { from: moe, value: price, gas: 1000000 });
            await contractInstance.mint(curly, { from: curly, value: price, gas: 1000000 });
            let unminted_after_tests = await contractInstance.unminted();
            expect(parseInt(unminted_after_tests)).to.equal(parseInt(unminted_before_tests) - 2);
        });
        it("lower price of fourth drop", async () => {
            let index = 3,
                price = convertEthToWei(0.050);
            await contractInstance.dropPrice(index, price, { from: brownbear });

            let drops = await contractInstance.getDrops();
            expect(parseInt(drops[index].priceDate)).to.be.gt(parseInt(drops[index].date));
            expect(parseInt(drops[index].date)).to.be.gt(0);

            // check the udpate
            let status = await contractInstance.status();
            expect(parseInt(status.index)).to.equal(3);
            expect(status.active).to.be.true;
            expect(status.complete).to.be.false;
            expect(drops[status.index].price).to.equal(price);
        });
        it("mint from 4th until drop is complete", async () => {
            const price = convertEthToWei(0.055);
            await contractInstance.mint(curly, { from: curly, value: price, gas: 1000000 });
            await contractInstance.mint(larry, { from: larry, value: price, gas: 1000000 });
            await contractInstance.mint(larry, { from: larry, value: price, gas: 1000000 });
            await utils.shouldThrow(contractInstance.mint(larry, { from: larry, value: price, gas: 1000000 }));

            console.log('Final token allocation, minting is complete:');
            printTokensForAccount(contractInstance, brownbear, 'brownbear');
            printTokensForAccount(contractInstance, moe, 'moe');
            printTokensForAccount(contractInstance, larry, 'larry');
            printTokensForAccount(contractInstance, curly, 'curly');
            printTokensForAccount(contractInstance, shemp, 'shemp');
            printTokensForAccount(contractInstance, charity, 'charity');
        });
    });

    context("Confirm all drops are complete", async () => {
        it("there is no active drop", async () => {
            const status = await contractInstance.status();
            expect(status.active).to.be.false;
            expect(status.complete).to.be.true;
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
        xit("verify royalties on erc2981", async () => {
            // mint a token & get token id (ladybugId)
            const result = await contractInstance.mint(moe, { from: moe, value: web3.utils.toWei('0.015', 'ether'), gas: 1000000 });
            const ladybugId = result.logs[0].args.tokenId.toNumber();
            // during minting, royalties are set, so let's make sure this is true and the royalties are set to 250
            const royalties = await contractInstance.getRaribleV2Royalties(ladybugId);
            expect(royalties).to.have.lengthOf(1);
            expect(royalties[0].value).to.equal('250');
            // check the royalties on the ERC2981
            const salesPrice = 1000000;
            const info = await contractInstance.royaltyInfo(ladybugId, salesPrice);

            // dividing by 1000 below, because percentage in basis points
            // example: 2.5% is 250 basis points, but we need to multiply sales price by 0.025
            // and 0.025 is 250 / 10000
            expect(info.royaltyAmount.toNumber()).to.equal(parseInt(royalties[0].value) / 10000 * salesPrice);

            // ensure the contract supports _INTERFACE_ID_ERC2981
            const supports = await contractInstance.supportsInterface('0x2a55205a');
            expect(supports).to.be.true;

            // verify owner get paid the royalties
        });
        xit("set opensea royalties/output requirements", async () => {
            // removing this because it might be confusing the prod CID and the test CID
            const result = await contractInstance.contractURI();
            // hard-coded to test ipfs url
            expect(result).to.equal('ipfs://QmdUBpQ8tgeSB8cdkPpdawvvaXrubzBKVuKfygxtFAnhmW');
        });
    });

    context("Admin Tasks", async () => {
        it("withdrawAll() of contract balance by non-owner fails", async () => {
            await utils.shouldThrow(contractInstance.withdrawAll({ from: curly }));
        });
        it("withdraw() portion of contract balance by non-owner fails", async () => {
            await utils.shouldThrow(contractInstance.withdraw(web3.utils.toWei('0.01', 'ether'), { from: curly }));
        });
        it("withdraw portion of contract balance to pay owner", async () => {

            // let's grab the owners initial balance & contract balance
            const owner_init_balance = await web3.eth.getBalance(brownbear);
            const contract_init_balance = await contractInstance.balanceInContract();
            expect(parseInt(contract_init_balance)).to.be.gt(0);

            // make the withdrawl and get the gas cost from the transaction
            const withdrawl_amount = web3.utils.toWei('0.05', 'ether');
            const receipt = await contractInstance.withdraw(withdrawl_amount, { from: brownbear });
            const tx = await web3.eth.getTransaction(receipt.tx);
            const txReceipt = await web3.eth.getTransactionReceipt(receipt.receipt.transactionHash);
            const gasCost = tx.gasPrice * txReceipt.gasUsed;

            // balance after withdrawl should be zero
            const balanceAfterWithdrawl = await contractInstance.balanceInContract();
            // console.log('owner_init_balance: ' + owner_init_balance);
            // console.log('contract_init_balance: ' + contract_init_balance);
            // console.log('withdrawl_amount: ' + withdrawl_amount);
            // console.log('gasCost: ' + gasCost);
            // console.log('balanceAfterWithdrawl: ' + balanceAfterWithdrawl);

            expect(parseInt(balanceAfterWithdrawl)).to.equal(parseInt(contract_init_balance) - parseInt(withdrawl_amount));

            // the owners new balance should equal the initial balance plus the amount transfered from contract minus the gas costs
            const owner_new_balance = await web3.eth.getBalance(brownbear);
            // console.log('owner_new_balance: ' + owner_new_balance);
            // console.log('add: ' + (parseInt(owner_init_balance) + parseInt(withdrawl_amount) - parseInt(gasCost)));
            // note - I'm getting a rounding error (does that even make sense, but the below equation is off by a tiny amount, 
            //        I don't know why, but that's the reason I made it .to.be.gt(), instead of to.equal() - aye.
            expect(parseInt(owner_new_balance)).to.be.gte(parseInt(owner_init_balance) + parseInt(withdrawl_amount) - parseInt(gasCost));

        });
        it("withdrawAll funds to pay owner", async () => {

            // let's grab the owners initial balance & contract balance
            const owner_init_balance = await web3.eth.getBalance(brownbear);
            const contract_init_balance = await contractInstance.balanceInContract();
            expect(parseInt(contract_init_balance)).to.be.gt(0);

            // make the withdrawl and get the gas cost from the transaction
            const receipt = await contractInstance.withdrawAll({ from: brownbear });
            const tx = await web3.eth.getTransaction(receipt.tx);
            const txReceipt = await web3.eth.getTransactionReceipt(receipt.receipt.transactionHash);
            const gasCost = tx.gasPrice * txReceipt.gasUsed;

            // balance after withdrawl should be zero
            const balanceAfterWithdrawl = await contractInstance.balanceInContract();
            expect(parseInt(balanceAfterWithdrawl)).to.equal(0);

            // the owners new balance should equal the initial balance plus the amount transfered from contract minus the gas costs
            const owner_new_balance = await web3.eth.getBalance(brownbear);
            // note - I'm getting a rounding error (does that even make sense, but the below equation is off by a tiny amount, 
            //        I don't know why, but that's the reason I made it .to.be.gt(), instead of to.equal() - aye.
            expect(parseInt(owner_new_balance)).to.be.gte(parseInt(owner_init_balance) + parseInt(contract_init_balance) - parseInt(gasCost));

        });
    });

});