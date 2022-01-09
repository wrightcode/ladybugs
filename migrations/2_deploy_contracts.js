var LadybugMinter = artifacts.require("LadybugMinter");

module.exports = function(deployer) {
  deployer.deploy(LadybugMinter);
};