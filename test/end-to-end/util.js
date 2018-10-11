/*
  Private/support function library for the end-to-end tests.
*/

module.exports = {
  openWallet,
  getBalance,
  createFixedToken,
  findBiggestUtxo,
  waitFor1Conf,
  sleep
}

// Set NETWORK to either testnet or mainnet
const NETWORK = `testnet`

const WH = require("../../lib/Wormhole").default

// Instantiate Wormhole based on the network.
if (NETWORK === `mainnet`)
  var Wormhole = new WH({ restURL: `https://rest.bitcoin.com/v1/` })
//else var Wormhole = new WH({ restURL: `https://trest.bitcoin.com/v1/` })
else var Wormhole = new WH({ restURL: `https://trest.bitcoin.com/v1/` })

// Inspect utility used for debugging.
const util = require("util")
util.inspect.defaultOptions = {
  showHidden: true,
  colors: true,
  depth: 1
}

// Open a wallet and return an object with its address, BCH balance, and WHC
// token balance.
async function openWallet(filename) {
  try {
    walletInfo = require(filename)

    const walletBalance = await getBalance(walletInfo)

    return walletBalance
  } catch (err) {
    console.log(
      `Could not open ${filename}. Generate a wallet with create-wallet first.`,
      err
    )
    process.exit(0)
  }
}

// Get the balance for an opened wallet.
async function getBalance(walletInfo) {
  try {
    // first get BCH balance
    const balance = await Wormhole.Address.details([walletInfo.cashAddress])

    walletInfo.bchBalance = balance[0]

    // get token balances
    try {
      const tokens = await Wormhole.DataRetrieval.balancesForAddress(
        walletInfo.cashAddress
      )

      walletInfo.tokenBalance = tokens

      return walletInfo
    } catch (error) {
      if (error.message === "Address not found") console.log(`No tokens found.`)
    }
  } catch (err) {
    console.error(`Error in getBalance()`)
    throw err
  }
}

// Create a fixed token.
async function createFixedToken() {
  try {
    const mnemonic = walletInfo.mnemonic

    // root seed buffer
    const rootSeed = Wormhole.Mnemonic.toSeed(mnemonic)

    // master HDNode
    if (NETWORK === `mainnet`)
      var masterHDNode = Wormhole.HDNode.fromSeed(rootSeed)
    else var masterHDNode = Wormhole.HDNode.fromSeed(rootSeed, "testnet") // Testnet

    // HDNode of BIP44 account
    const account = Wormhole.HDNode.derivePath(masterHDNode, "m/44'/145'/0'")

    const change = Wormhole.HDNode.derivePath(account, "0/0")

    // get the cash address
    //let cashAddress = Wormhole.HDNode.toCashAddress(change);
    const cashAddress = walletInfo.cashAddress

    // Create the fixed token.
    const fixed = await Wormhole.PayloadCreation.fixed(
      //console.log(txHex);
      1, // Ecosystem, must be 1.
      8, // Precision, number of decimal places. Must be 0-8.
      0, // Predecessor token. 0 for new tokens.
      "Companies", // Category.
      "End-to-End Testing", // Subcategory
      "TST", // Name/Ticker
      "developer.bitcoin.com", // URL
      "Fixed Token E2E Test", // Description.
      "4567" // amount
    )

    // Get a utxo to use for this transaction.
    const u = await Wormhole.Address.utxo([cashAddress])
    const utxo = findBiggestUtxo(u[0])

    // Create a rawTx using the largest utxo in the wallet.
    utxo.value = utxo.amount
    const rawTx = await Wormhole.RawTransactions.create([utxo], {})

    // Add the token information as an op-return code to the tx.
    const opReturn = await Wormhole.RawTransactions.opReturn(rawTx, fixed)

    // Set the destination/recieving address
    const ref = await Wormhole.RawTransactions.reference(opReturn, cashAddress)

    // Generate a change output.
    const changeHex = await Wormhole.RawTransactions.change(
      ref, // Raw transaction we're working with.
      [utxo], // Previous utxo
      cashAddress, // Destination address.
      0.000005 // Miner fee.
    )

    const tx = Wormhole.Transaction.fromHex(changeHex)
    const tb = Wormhole.Transaction.fromTransaction(tx)

    // Finalize and sign transaction.
    const keyPair = Wormhole.HDNode.toKeyPair(change)
    let redeemScript
    tb.sign(0, keyPair, redeemScript, 0x01, utxo.satoshis)
    const builtTx = tb.build()
    const txHex = builtTx.toHex()

    // sendRawTransaction to running BCH node
    const broadcast = await Wormhole.RawTransactions.sendRawTransaction(txHex)
    //console.log(`Transaction ID: ${broadcast}`)

    return broadcast
  } catch (err) {
    console.log(err)
  }
}

// Returns the utxo with the biggest balance from an array of utxos.
function findBiggestUtxo(utxos) {
  let largestAmount = 0
  let largestIndex = 0

  for (let i = 0; i < utxos.length; i++) {
    const thisUtxo = utxos[i]

    if (thisUtxo.satoshis > largestAmount) {
      largestAmount = thisUtxo.satoshis
      largestIndex = i
    }
  }

  return utxos[largestIndex]
}

async function waitFor1Conf(txid) {
  const txInfo = await getTxInfo(txid)

  console.log(`txInfo: ${util.inspect(txInfo)}`)
}

// Get Token info from the TX.
async function getTxInfo(txid) {
  const retVal = await Wormhole.DataRetrieval.transaction(txid)

  //console.log(`Info from TXID ${TXID}: ${JSON.stringify(retVal, null, 2)}`)
  return retVal
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
