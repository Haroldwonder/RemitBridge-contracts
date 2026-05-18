const request = require('supertest');
const jwt = require('jsonwebtoken');

// Mock DB and stellar service
jest.mock('../src/db', () => ({
  pool: { query: jest.fn() },
  initDb: jest.fn().mockResolvedValue(),
}));
jest.mock('../src/services/stellar', () => ({
  submitBatch: jest.fn(),
  estimateFee: jest.fn().mockReturnValue('0.0005000'),
}));

process.env.JWT_SECRET = 'test-secret';
process.env.DATABASE_URL = 'postgres://test';

const app = require('../src/index');
const { pool } = require('../src/db');
const { submitBatch } = require('../src/services/stellar');

const ORG = { id: 1, name: 'TestOrg' };
const TOKEN = jwt.sign(ORG, 'test-secret');
const AUTH = { Authorization: `Bearer ${TOKEN}` };

beforeEach(() => pool.query.mockReset());

describe('POST /api/batches', () => {
  test('creates batch and returns fee preview', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 42, status: 'pending', total_amount: 30, currency: 'USDC', recipient_count: 2 }] })
      .mockResolvedValue({ rows: [] }); // payment inserts

    const res = await request(app)
      .post('/api/batches')
      .set(AUTH)
      .send({
        currency: 'USDC',
        payments: [
          { stellar_address: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN', amount: '10' },
          { stellar_address: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN', amount: '20' },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.batch.id).toBe(42);
    expect(res.body.fee_xlm).toBe('0.0005000');
    expect(res.body.total).toBe(30);
  });

  test('rejects invalid currency', async () => {
    const res = await request(app)
      .post('/api/batches')
      .set(AUTH)
      .send({ currency: 'BTC', payments: [{ stellar_address: 'G...', amount: '1' }] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/currency/);
  });

  test('rejects empty payments', async () => {
    const res = await request(app)
      .post('/api/batches')
      .set(AUTH)
      .send({ currency: 'USDC', payments: [] });
    expect(res.status).toBe(400);
  });

  test('requires auth', async () => {
    const res = await request(app).post('/api/batches').send({ currency: 'USDC', payments: [] });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/batches/:id/submit', () => {
  test('rejects missing secret_key', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'pending', org_id: 1 }] });
    const res = await request(app)
      .post('/api/batches/1/submit')
      .set(AUTH)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/secret_key/);
  });

  test('rejects already-submitted batch', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'complete', org_id: 1 }] });
    const res = await request(app)
      .post('/api/batches/1/submit')
      .set(AUTH)
      .send({ secret_key: 'STEST' });
    expect(res.status).toBe(409);
  });
});
