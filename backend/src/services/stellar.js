const StellarSdk = require('stellar-sdk');

const HORIZON_URL = 'https://horizon-testnet.stellar.org';
const networkPassphrase = StellarSdk.Networks.TESTNET;

// Asset definitions
const ASSETS = {
  USDC: new StellarSdk.Asset('USDC', 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'),
  PYUSD: new StellarSdk.Asset('PYUSD', 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'),
  XLM: StellarSdk.Asset.native(),
};

// Create server lazily so jest.mock can replace the constructor before first call
function getServer() {
  return new StellarSdk.Horizon.Server(HORIZON_URL);
}

/**
 * Submit a batch of payments from one source account.
 * Stellar allows up to 100 operations per transaction.
 * For >100 recipients we chunk into multiple transactions.
 *
 * @param {string} secretKey - source account secret
 * @param {Array<{stellar_address, amount, currency}>} payments
 * @returns {Array<{index, tx_hash, status, error}>}
 */
async function submitBatch(secretKey, payments) {
  const server = getServer();
  const keypair = StellarSdk.Keypair.fromSecret(secretKey);
  const sourceAccount = await server.loadAccount(keypair.publicKey());

  const results = [];
  const CHUNK = 100;

  for (let i = 0; i < payments.length; i += CHUNK) {
    const chunk = payments.slice(i, i + CHUNK);
    const builder = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase,
    }).setTimeout(30);

    for (const p of chunk) {
      const asset = ASSETS[p.currency] || ASSETS.USDC;
      builder.addOperation(
        StellarSdk.Operation.payment({
          destination: p.stellar_address,
          asset,
          amount: String(p.amount),
        })
      );
    }

    const tx = builder.build();
    tx.sign(keypair);

    try {
      const response = await server.submitTransaction(tx);
      chunk.forEach((_, j) => {
        results.push({ index: i + j, tx_hash: response.hash, status: 'success' });
      });
      // Advance sequence for next chunk
      sourceAccount.incrementSequenceNumber();
    } catch (e) {
      const detail = e.response?.data?.extras?.result_codes || e.message;
      chunk.forEach((_, j) => {
        results.push({ index: i + j, tx_hash: null, status: 'failed', error: JSON.stringify(detail) });
      });
    }
  }

  return results;
}

/**
 * Estimate fee for N payments (in XLM stroops, returned as XLM string)
 */
function estimateFee(count) {
  const stroops = parseInt(StellarSdk.BASE_FEE) * count;
  return (stroops / 1e7).toFixed(7);
}

module.exports = { submitBatch, estimateFee };
