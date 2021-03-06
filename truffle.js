var TruffleConfig = require('@aragon/os/truffle-config');
module.exports = {
  TruffleConfig,
  networks: {
    localhost: {
      host: "127.0.0.1",
      port: 8545,
      gas: 6721975,
    //gasLimit: 67219750,
    //gasPrice: 20000,
      network_id: "*",
      ens: {
        registry: {
          address: "0xB9462EF3441346dBc6E49236Edbb0dF207db09B7"
        }
      }
    }
  },
  compilers: {
    solc: {
      //version: "^0.4.24", // A version or constraint - Ex. "^0.5.0"
      version: "native", // A version or constraint - Ex. "^0.5.0"
                         // Can also be set to "native" to use a native solc
      parser: "solcjs",  // Leverages solc-js purely for speedy parsing
      settings: {
        optimizer: {
          enabled: true,
          runs: 200   // Optimize for how many times you intend to run the code
        }
      }
    }
  },
  ens: {
    enabled: true
  }
};
