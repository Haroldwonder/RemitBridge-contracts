const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../src/db', () => ({
  pool: { query: jest.fn() },
  initDb: jest.fn().mockResolvedValue(),
}));
jest.mock('../src/services/stellar', () => ({
  submitBatch: jest.fn(),
  estimateFee: jest.fn().mockReturnValue('0.0005000'),
}));
jest.mock('../src/events/EventPublisher', () => ({
  eventPublisher: { publish: jest.fn().mockResolvedValue(1) },
  EventPublisher: jest.fn(),
}));
jest.mock('../src/events/EventSchemas', () => ({
  Schemas: { beneficiaryCreated: jest.fn().mockReturnValue({}) },
  EventTypes: {},
  EVENT_VERSION: '1.0',
}));

process.env.JWT_SECRET = 'test-secret';
process.env.DATABASE_URL = 'postgres://test';
process.env.CORS_ORIGINS = 'http://localhost:5173';

const app = require('../src/index');
const { pool } = require('../src/db');
const { eventPublisher } = require('../src/events/EventPublisher');

const ORG = { id: 1, name: 'TestOrg' };
const TOKEN = jwt.sign(ORG, 'test-secret');
const AUTH = { Authorization: `Bearer ${TOKEN}` };

beforeEach(() => {
  pool.query.mockReset();
  eventPublisher.publish.mockReset().mockResolvedValue(1);
});

describe('GET /api/recipients', () => {
  test('returns paginated recipient list', async () => {
    pool.query.mockResolvedValue({
      rows: [
        { id: 1, name: 'Alice', kyc_status: 'approved', country: 'KE' },
        { id: 2, name: 'Bob', kyc_status: 'pending', country: 'NG' },
      ],
    });
    const res = await request(app).get('/api/recipients').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  test('supports search query', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: 1, name: 'Alice' }] });
    const res = await request(app).get('/api/recipients?search=alice').set(AUTH);
    expect(res.status).toBe(200);
  });

  test('supports kyc_status filter', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    const res = await request(app).get('/api/recipients?kyc_status=approved').set(AUTH);
    expect(res.status).toBe(200);
  });

  test('requires auth', async () => {
    const res = await request(app).get('/api/recipients');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/recipients', () => {
  test('creates recipient and emits event', async () => {
    pool.query.mockResolvedValue({
      rows: [{ id: 5, name: 'Carol', org_id: 1, kyc_status: 'pending', country: 'GH' }],
    });
    const res = await request(app)
      .post('/api/recipients')
      .set(AUTH)
      .send({ name: 'Carol', country: 'GH' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Carol');
    expect(eventPublisher.publish).toHaveBeenCalled();
  });

  test('rejects missing name', async () => {
    const res = await request(app).post('/api/recipients').set(AUTH).send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name/);
  });

  test('rejects invalid Stellar address', async () => {
    const res = await request(app)
      .post('/api/recipients')
      .set(AUTH)
      .send({ name: 'Dave', stellar_address: 'invalid-address' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Stellar/);
  });

  test('accepts recipient without stellar address', async () => {
    pool.query.mockResolvedValue({
      rows: [{ id: 6, name: 'Eve', stellar_address: null, country: 'GH' }],
    });
    const res = await request(app)
      .post('/api/recipients')
      .set(AUTH)
      .send({ name: 'Eve', country: 'GH' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Eve');
  });
});

describe('PUT /api/recipients/:id', () => {
  test('updates recipient fields', async () => {
    pool.query.mockResolvedValue({
      rows: [{ id: 1, name: 'Alice Updated', org_id: 1 }],
    });
    const res = await request(app)
      .put('/api/recipients/1')
      .set(AUTH)
      .send({ name: 'Alice Updated', country: 'TZ' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Alice Updated');
    expect(eventPublisher.publish).toHaveBeenCalled();
  });

  test('returns 404 when recipient not found', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    const res = await request(app).put('/api/recipients/999').set(AUTH).send({ name: 'X' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/recipients/:id', () => {
  test('soft-deletes recipient', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: 1 }] });
    const res = await request(app).delete('/api/recipients/1').set(AUTH);
    expect(res.status).toBe(204);
    // Should use soft delete (UPDATE ... deleted_at=NOW())
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('deleted_at=NOW()'),
      expect.any(Array)
    );
  });

  test('returns 404 when not found', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    const res = await request(app).delete('/api/recipients/999').set(AUTH);
    expect(res.status).toBe(404);
  });
});
