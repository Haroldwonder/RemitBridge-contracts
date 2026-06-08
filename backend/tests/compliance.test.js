const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../src/db', () => ({
  pool: { query: jest.fn() },
  initDb: jest.fn().mockResolvedValue(),
}));
jest.mock('../src/events/EventPublisher', () => ({
  eventPublisher: { publish: jest.fn().mockResolvedValue(1) },
  EventPublisher: jest.fn(),
}));
jest.mock('../src/events/EventSchemas', () => ({
  Schemas: { complianceCheckCompleted: jest.fn().mockReturnValue({}) },
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
  eventPublisher.publish.mockReset();
  eventPublisher.publish.mockResolvedValue(1);
});

describe('POST /api/compliance/checks', () => {
  test('creates a KYC check and updates recipient status', async () => {
    const mockRecord = {
      id: 1, org_id: 1, recipient_id: 5, check_type: 'kyc',
      status: 'passed', risk_score: 20, checked_at: new Date().toISOString(),
    };
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 5 }] })  // recipient lookup
      .mockResolvedValueOnce({ rows: [mockRecord] })  // insert
      .mockResolvedValueOnce({ rows: [] });            // KYC status update

    const res = await request(app)
      .post('/api/compliance/checks')
      .set(AUTH)
      .send({ recipient_id: 5, check_type: 'kyc', status: 'passed', risk_score: 20 });

    expect(res.status).toBe(201);
    expect(res.body.check_type).toBe('kyc');
    expect(res.body.status).toBe('passed');
    expect(eventPublisher.publish).toHaveBeenCalled();
  });

  test('rejects invalid check_type', async () => {
    const res = await request(app)
      .post('/api/compliance/checks')
      .set(AUTH)
      .send({ check_type: 'fingerprint', status: 'passed' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/check_type/);
  });

  test('rejects invalid status', async () => {
    const res = await request(app)
      .post('/api/compliance/checks')
      .set(AUTH)
      .send({ check_type: 'kyc', status: 'unknown' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/status/);
  });

  test('requires auth', async () => {
    const res = await request(app).post('/api/compliance/checks').send({ check_type: 'kyc' });
    expect(res.status).toBe(401);
  });

  test('emits sanctions event when sanctions check fails', async () => {
    const mockRecord = { id: 2, recipient_id: 6, check_type: 'sanctions', status: 'failed', risk_score: null };
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 6 }] })
      .mockResolvedValueOnce({ rows: [mockRecord] })
      .mockResolvedValueOnce({ rows: [] });

    await request(app)
      .post('/api/compliance/checks')
      .set(AUTH)
      .send({ recipient_id: 6, check_type: 'sanctions', status: 'failed' });

    // Should emit both compliance check and sanctions match events
    expect(eventPublisher.publish).toHaveBeenCalledTimes(2);
  });
});

describe('GET /api/compliance/checks', () => {
  test('returns paginated list', async () => {
    pool.query.mockResolvedValue({
      rows: [{ id: 1, check_type: 'kyc', status: 'passed', recipient_name: 'Alice' }],
    });
    const res = await request(app).get('/api/compliance/checks').set(AUTH);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('supports check_type filter', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    const res = await request(app).get('/api/compliance/checks?check_type=sanctions').set(AUTH);
    expect(res.status).toBe(200);
  });
});

describe('GET /api/compliance/recipients/:id/status', () => {
  test('returns consolidated compliance view', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 5, name: 'Alice', kyc_status: 'approved', trust_score: 80 }] })
      .mockResolvedValueOnce({ rows: [{ check_type: 'kyc', status: 'passed', risk_score: 20, checked_at: new Date(), expires_at: null }] });

    const res = await request(app).get('/api/compliance/recipients/5/status').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('recipient');
    expect(res.body).toHaveProperty('compliance');
    expect(res.body.compliance.blocked).toBe(false);
    expect(res.body.compliance.checks).toHaveProperty('kyc');
  });

  test('flags blocked recipient with failed check', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 5, name: 'Bob', kyc_status: 'rejected', trust_score: 0 }] })
      .mockResolvedValueOnce({ rows: [{ check_type: 'sanctions', status: 'failed', risk_score: 99, checked_at: new Date(), expires_at: null }] });

    const res = await request(app).get('/api/compliance/recipients/5/status').set(AUTH);
    expect(res.body.compliance.blocked).toBe(true);
  });
});

describe('POST /api/compliance/screen', () => {
  test('screens batch recipients', async () => {
    pool.query.mockResolvedValue({
      rows: [
        { recipient_id: 1, kyc_status: 'approved', trust_score: 75, sanctions_match: false },
        { recipient_id: 2, kyc_status: 'pending', trust_score: 40, sanctions_match: false },
      ],
    });
    const res = await request(app)
      .post('/api/compliance/screen')
      .set(AUTH)
      .send({ batch_id: 10 });
    expect(res.status).toBe(200);
    expect(res.body.clearance).toBe('clear');
    expect(res.body.warnings).toHaveLength(1);
    expect(res.body.issues).toHaveLength(0);
  });

  test('returns blocked when sanctions match found', async () => {
    pool.query.mockResolvedValue({
      rows: [{ recipient_id: 1, kyc_status: 'approved', trust_score: 75, sanctions_match: true }],
    });
    const res = await request(app)
      .post('/api/compliance/screen')
      .set(AUTH)
      .send({ batch_id: 10 });
    expect(res.body.clearance).toBe('blocked');
    expect(res.body.issues).toHaveLength(1);
  });

  test('requires batch_id', async () => {
    const res = await request(app).post('/api/compliance/screen').set(AUTH).send({});
    expect(res.status).toBe(400);
  });
});
