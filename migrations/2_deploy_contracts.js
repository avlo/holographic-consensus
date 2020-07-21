/* global artifacts */
// var CounterApp = artifacts.require('CounterApp.sol')
var HCVoting = artifacts.require('HCVoting.sol')

module.exports = function(deployer) {
  // deployer.deploy(CounterApp)
  deployer.deploy(HCVoting)
}
