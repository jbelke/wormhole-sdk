/*
  Create an HDNode wallet using Bitbox. The mnemonic from this wallet
  will be used in future examples.
*/

"use strict";

const BITBOXCli = require("bitbox-cli/lib/bitbox-cli").default;
const BITBOX = new BITBOXCli({ restURL: "https://trest.bitcoin.com/v1/" });
const WH = require("../../src/node/Wormhole");
const Wormhole = new WH({
  restURL: `https://wormholecash-staging.herokuapp.com/v1/`
});

// Open the wallet generated with create-wallet.
let walletInfo;
try {
  walletInfo = require(`../create-wallet/wallet.json`);
} catch (err) {
  console.log(
    `Could not open wallet.json. Generate a wallet with create-wallet first.`
  );
  process.exit(0);
}

async function getBalance() {
  try {
    // first get BCH balance
    let balance = await BITBOX.Address.details([
      "bchtest:qzgmwth8jkyvr0juke4ug87f6eehnyfq45ckq46ckv"
    ]);

    // get token balances
    balance.tokens = await Wormhole.DataRetrieval.balancesForAddress(
      "bchtest:qzgmwth8jkyvr0juke4ug87f6eehnyfq45ckq46ckv"
    );
    console.log(balance);
  } catch (err) {
    console.error(`Error in getBalance: `, err);
    throw err;
  }
}
getBalance();
