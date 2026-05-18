const StellarSdk = require('stellar-sdk');

// Shared mock server instance — constructor always returns the same object
const mockServer = {
  loadAccount: jest.fn(),
  submitTransaction: jest.fn(),
};

jest.mock('stellar-sdk', () => {
  const actual = jest.requireActual('stellar-sdk');
  return {
    ...actual,
    Horizon: {
      Server: jest.fn().mockImplementation(() => mockServer),
    },
  };
});

const { submitBatch, estimateFee } = require('../src/services/stellar');

describe('estimateFee', () => {
  test('returns correct XLM fee for N payments', () => {
    // BASE_FEE is 100 stroops = 0.00001 XLM per operation
    expect(estimateFee(1)).toBe('0.0000100');
    expect(estimateFee(50)).toBe('0.0005000');
    expect(estimateFee(100)).toBe('0.0010000');
  });

  test('fee scales linearly', () => {
    const fee10 = parseFloat(estimateFee(10));
    const fee20 = parseFloat(estimateFee(20));
    expect(fee20).toBeCloseTo(fee10 * 2, 7);
  });
});

describe('submitBatch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const keypair = StellarSdk.Keypair.random();
    mockServer.loadAccount.mockResolvedValue({
      id: keypair.publicKey(),
      sequence: '1000',
      incrementSequenceNumber: jest.fn(),
      accountId: () => keypair.publicKey(),
      sequenceNumber: () => '1000',
    });
  });

  test('returns success results when transaction submits', async () => {
    mockServer.submitTransaction.mockResolvedValue({ hash: 'abc123txhash' });

    const keypair = StellarSdk.Keypair.random();
    const payments = [
      { stellar_address: StellarSdk.Keypair.random().publicKey(), amount: '10', currency: 'USDC' },
      { stellar_address: StellarSdk.Keypair.random().publicKey(), amount: '20', currency: 'USDC' },
    ];

    const results = await submitBatch(keypair.secret(), payments);
    expect(results).toHaveLength(2);
    results.forEach(r => {
      expect(r.status).toBe('success');
      expect(r.tx_hash).toBe('abc123txhash');
    });
  });

  test('returns failed results when transaction throws', async () => {
    const err = new Error('tx failed');
    err.response = { data: { extras: { result_codes: { transaction: 'tx_bad_seq' } } } };
    mockServer.submitTransaction.mockRejectedValue(err);

    const keypair = StellarSdk.Keypair.random();
    const payments = [
      { stellar_address: StellarSdk.Keypair.random().publicKey(), amount: '5', currency: 'PYUSD' },
    ];

    const results = await submitBatch(keypair.secret(), payments);
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('failed');
    expect(results[0].tx_hash).toBeNull();
    expect(results[0].error).toContain('tx_bad_seq');
  });

  test('chunks batches of >100 into multiple transactions', async () => {
    mockServer.submitTransaction.mockResolvedValue({ hash: 'chunkhash' });

    const keypair = StellarSdk.Keypair.random();
    const payments = Array.from({ length: 150 }, () => ({
      stellar_address: StellarSdk.Keypair.random().publicKey(),
      amount: '1',
      currency: 'USDC',
    }));

    const results = await submitBatch(keypair.secret(), payments);
    expect(results).toHaveLength(150);
    // Should have called submitTransaction twice (100 + 50)
    expect(mockServer.submitTransaction).toHaveBeenCalledTimes(2);
  });

  test('partial failure: second chunk fails, first succeeds', async () => {
    mockServer.submitTransaction
      .mockResolvedValueOnce({ hash: 'firsthash' })
      .mockRejectedValueOnce(new Error('network error'));

    const keypair = StellarSdk.Keypair.random();
    const payments = Array.from({ length: 110 }, () => ({
      stellar_address: StellarSdk.Keypair.random().publicKey(),
      amount: '1',
      currency: 'USDC',
    }));

    const results = await submitBatch(keypair.secret(), payments);
    const successes = results.filter(r => r.status === 'success');
    const failures = results.filter(r => r.status === 'failed');
    expect(successes).toHaveLength(100);
    expect(failures).toHaveLength(10);
  });
});
